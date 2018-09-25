'use strict';

const { EventEmitter } = require('events');
const requests = require('./wiser-requests');
const validators = require('./wiser-validators');
const helpers = require('./wiser-helpers');

const isChildProcess = typeof process.send === 'function';

const DEFAULT_ZONE_COLOR = '#ee4f29';

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
 * Creates a full set of connector options and merges with the provided options. Missing parameters will be added set to default values.
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

  async _updateZoneData() {
    try {
      const zones = await requests.getZones(this.options);

      zones.forEach(zone => {
        if (this.zones[zone.id]) {
          Object.assign(this.zones[zone.id], zone);
        } else {
          this.zones[zone.id] = zone;
        }
      });

      if (this.options.zones.length) {
        let id, zone;
        for (let i = this.options.zones.length - 1; i > -1; i--) {
          id = 1000 + i;
          zone = this.options.zones[i];
          try {
            zone.id = id;
            zone.color = zone.color || DEFAULT_ZONE_COLOR;

            await requests.createZone(this.options, zone);

            this.zones[id] = zone;
            this.options.zones.splice(i, 1); // remove the zone from the options on successful creation
          } catch (err) {
            this._emitEventMessage('error', err);
          }
        }
      }
    } catch (err) {
      this._emitEventMessage('error', err);
    }
  }

  async _update() {
    if (!this.enabled) return;

    await this._updateZoneData();

    let tagReport;

    try {
      tagReport = await requests.passiveTagReport(this.options);
    } catch (err) {
      this._emitEventMessage('error', err);
    }

    if (tagReport) {
      helpers.uniqueFilterTagReport(tagReport);

      tagReport.forEach(tag => {
        const current = this.tags[tag.tag];
        if (current) {
          if (current.timestamp < tag.timestamp) {
            if (this.options.reportTagZoneTransitions) {
              let transitions = helpers.getZoneTransitions(
                current.zones.map(z => z.id),
                tag.zones.map(z => z.id)
              );

              transitions.enter.forEach(id => {
                if (this.zones[id] && this.zones[id].name) {
                  this._emitEventMessage(event.tagZoneTransition, {
                    type: 'enter',
                    tag: tag,
                    zone: this.zones[id].name
                  });
                }
              });

              transitions.exit.forEach(id => {
                if (this.zones[id] && this.zones[id].name) {
                  this._emitEventMessage(event.tagZoneTransition, {
                    type: 'exit',
                    tag: tag,
                    zone: this.zones[id].name
                  });
                }
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
        `${options.id ||
          this.options.id} is already started - shut it down and try again`
      );
    }

    if (options.zones && Array.isArray(options.zones)) {
      const validZones = [];

      options.zones.forEach(z => {
        try {
          validators.validateZoneDefinition(z);
          validZones.push(z);
        } catch (err) {
          console.log(err.message);
        }
      });

      options.zones = validZones;
    } else {
      options.zones = [];
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
