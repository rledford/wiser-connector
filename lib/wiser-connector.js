'use strict';

const { EventEmitter } = require('events');
const requests = require('./wiser-requests');

const isChildProcess = typeof process.send === 'function';

const event = {
  start: 'start',
  shutdown: 'shutdown',
  tagUpdate: 'tagUpdate',
  tagZoneTransition: 'tagZoneTransition',
  connectionError: 'connectionError',
  healthStatusUpdate: 'healthStatusUpdate'
};

/**
 * @param {*} options
 *
 * Creates a full set of connector options with the provided options. Missing parameters will be added set to default values.
 */
function createOptions(options = {}) {
  let result = {
    id: 'WiserConnector',
    hostname: '127.0.0.1',
    port: 3101,
    reportTagUpdates: true,
    reportTagZoneTransitions: true,
    updateInterval: 500,
    healthCheckInterval: 300000,
    zones: [] // custom zones
  };

  for (let opt in result) {
    if (options[opt]) {
      result[opt] = options[opt];
    }
  }

  return result;
}

/**
 *
 * @param {Array} tagReport - the response from the /wiser/api/passivetagreport
 *
 * Sorts the tag rerpot by timestamp, in descending order, and removes duplicate tag ID entries so that only the most current tag data is in the report. Manipulates the provided array.
 */
function uniqueFilterTagReport(tagReport) {
  tagReport.sort((a, b) => {
    return a.timestamp >= b.timestamp ? -1 : 1;
  });

  let unique = {};

  for (let i = tagReport.length - 1; i > -1; i--) {
    if (unique[tagReport[i].tag]) {
      tagReport.splice(i, 1);
    } else {
      unique[tagReport[i].tag] = 1;
    }
  }
}

/**
 *
 * @param {Array} lastIdList - the last list of zone IDs a tag was in
 * @param {Array} nextIdList - the next list of zone IDs a tag is in
 * @returns {Object}
 *
 * Returns an Object {enter: [id...], exit: [id...]} describing what transitions occured
 */
function getZoneTransitions(lastIdList = [], nextIdList = []) {
  let enter, exit;

  enter = nextIdList.filter(id => {
    return lastIdList.indexOf(id) === -1;
  });
  exit = lastIdList.filter(id => {
    return nextIdList.indexOf(id) === -1;
  });

  return { enter, exit };
}

/**
 * Requests data from a Wiser instance and reports tag updates, zone transitions, and health status information.
 */
class WiserConnector extends EventEmitter {
  constructor() {
    super();

    this.options = createOptions();
    this.enabled = false;
    this.tags = {};
    this.zones = {}; // wiser zones - custom zones in options are merged on the first update

    if (isChildProcess) {
      this.on('message', message => {
        const { command, options } = message;
        switch (command) {
          case 'start':
            processInstance.start(options);
            break;
          case 'shutdown':
            processInstance.shutdown();
            break;
          default:
            console.log(`${this.id} :: unknown command ${command}`);
        }
      });
    }
  }

  _emitEventMessage(event, message) {
    if (isChildProcess) {
      process.send({
        event,
        data: message
      });
    } else {
      this.emit(event, message);
    }
  }

  async _update() {
    if (!this.enabled) return;

    try {
      const zoneIdList = [];
      const zones = await requests.getZones(this.options);
      zones.forEach(zone => {
        zoneIdList.push(zone.id);
        if (this.zones[zone.id]) {
          Object.assign(this.zones[zone.id], zone);
        } else {
          this.zones[zone.id] = zone;
        }
      });

      if (this.options.zones) {
        this.options.zones.forEach(async zone => {
          if (zoneIdList.indexOf(zone.id) === -1) {
            console.log('sending custom zone data to Wiser instance');
            try {
              await requests.createZone(this.options, zone);
            } catch (err) {
              console.log(err);
            }

            this.zones[zone.id] = zone;
          }
        });
      }
    } catch (err) {
      console.log(err);
      this._emitEventMessage(event.connectionError, err);
    }

    let tagReport;

    try {
      tagReport = await requests.passiveTagReport(this.options);
    } catch (err) {
      console.log(err);
      this._emitEventMessage(event.connectionError, err);
    }

    if (tagReport) {
      uniqueFilterTagReport(tagReport);

      tagReport.forEach(tag => {
        let current = this.tags[tag.tag];
        if (current) {
          if (current.timestamp < tag.timestamp) {
            // check for zone transitions
            if (this.options.reportTagZoneTransitions) {
              let transitions = getZoneTransitions(
                current.zones.map(z => z.id),
                tag.zones.map(z => z.id)
              );

              transitions.enter.forEach(id => {
                this._emitEventMessage(event.tagZoneTransition, {
                  type: 'enter',
                  tag: tag,
                  zone: this.zones[id].name
                });
              });
              transitions.exit.forEach(id => {
                this._emitEventMessage(event.tagZoneTransition, {
                  type: 'exit',
                  tag: tag,
                  zone: this.zones[id].name
                });
              });
            }

            // apply updates
            Object.assign(this.tags[tag.tag], tag);

            if (this.options.reportTagUpdates) {
              this._emitEventMessage(event.tagUpdate, tag);
            }
          }
        } else {
          this.tags[tag.tag] = tag;
        }
      });
    }

    setTimeout(this._update.bind(this), this.options.updateInterval);
  }

  /**
   *
   * @param {Object} options - runtime options
   *
   * Starts the connector using the provided options
   */
  start(options = {}) {
    if (this.enabled) {
      return console.log(
        `${this.options.id} is already started - shut it down and try again`
      );
    }

    for (let opt in this.options) {
      if (options[opt] !== undefined) {
        this.options[opt] = options[opt];
      }
    }

    this.enabled = true;

    this._update();
  }

  /**
   * Shuts down the connector
   */
  shutdown() {
    this.enabled = false;
  }
}

const processInstance = isChildProcess ? new WiserConnector() : null;

module.exports = {
  event,
  createOptions,
  createConnector: () => new WiserConnector()
};
