'use strict';

const { EventEmitter } = require('events');
const requests = require('./wiser-requests');
const validators = require('./wiser-validators');
const helpers = require('./wiser-helpers');

const isChildProcess = typeof process.send === 'function';

const DEFAULT_ZONE_COLOR = '#ee4f29';

const event = {
  tagUpdate: 'tagUpdate',
  zoneTransition: 'zoneTransition',
  status: 'status'
};

/**
 * @param {*} options
 *
 * Creates a full set of connector options and merges with the provided options.
 */
function createOptions(options = {}) {
  let result = {
    id: 'WiserConnector',
    hostname: '127.0.0.1',
    port: 3101,
    reportTagUpdates: true,
    reportZoneTransitions: true,
    updateInterval: 500,
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
    this._started = false;
    this._tags = {};
    this._zones = {};

    if (isChildProcess) {
      this.on('message', message => {
        const { command, options } = message;
        switch (command) {
          case 'start':
            processInstance.start(options);
            break;
          case 'status':
            processInstance.status();
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

  async _createZones() {
    let id, zone;
    for (let i = this.options.zones.length - 1; i > -1; i--) {
      id = 1000 + i;
      zone = this.options.zones[i];
      try {
        zone.id = id;
        zone.color = zone.color || DEFAULT_ZONE_COLOR;

        await requests.createZone(this.options, zone);

        this.options.zones.splice(i, 1); // remove the zone from the options on successful creation
      } catch (err) {
        this._emitEventMessage('error', err);
      }
    }
  }

  async _update() {
    if (!this._started) return;

    let tagReport, zones;
    let delayNextUpdate = false;

    try {
      await this._createZones();
    } catch (err) {
      this._emitEventMessage('error', err);
      delayNextUpdate = true;
    }

    try {
      tagReport = await requests.getPassiveTagReport(this.options);
      zones = await requests.getZones(this.options);
    } catch (err) {
      this._emitEventMessage('error', err);
      delayNextUpdate = true;
    }

    if (zones) {
      let idList = [];

      zones.forEach(zone => {
        idList.push(`${zone.id}`);
        if (this._zones[zone.id]) {
          Object.assign(this._zones[zone.id], zone);
        } else {
          this._zones[zone.id] = zone;
        }
      });

      for (let id in this._zones) {
        if (idList.indexOf(id) === -1) {
          delete this._zones[id];
        }
      }
    }

    if (tagReport) {
      helpers.uniqueFilterTagReport(tagReport);

      tagReport.forEach(tag => {
        const current = this._tags[tag.tag];
        if (current) {
          if (current.timestamp < tag.timestamp) {
            if (this.options.reportZoneTransitions) {
              let transitions = helpers.getZoneTransitions(
                current.zones.map(z => z.id),
                tag.zones.map(z => z.id)
              );

              transitions.enter.forEach(id => {
                if (this._zones[id] && this._zones[id].name) {
                  this._emitEventMessage(event.zoneTransition, {
                    type: 'enter',
                    tag: tag,
                    zone: this._zones[id].name
                  });
                }
              });

              transitions.exit.forEach(id => {
                if (this._zones[id] && this._zones[id].name) {
                  this._emitEventMessage(event.zoneTransition, {
                    type: 'exit',
                    tag: tag,
                    zone: this._zones[id].name
                  });
                }
              });
            }

            // apply updates
            Object.assign(this._tags[tag.tag], tag);

            if (this.options.reportTagUpdates) {
              this._emitEventMessage(event.tagUpdate, tag);
            }
          }
        } else {
          this._tags[tag.tag] = tag;
        }
      });
    }

    setTimeout(
      this._update.bind(this),
      delayNextUpdate ? 5000 : this.options.updateInterval
    );
  }

  /**
   * Sends a request to /wiser/api/arena to get the current status information and emits the status data. Listeners should be registered to the 'status' event.
   */
  async status() {
    try {
      const status = await requests.getArena();
      this._emitEventMessage(event.status, status);
    } catch (err) {
      this._emitEventMessage('error', err);
    }
  }

  /**
   * Returns true if the connector is started
   */
  isStarted() {
    return this._started;
  }

  /**
   *
   * @param {Object} options - runtime options
   *
   * Starts the connector using the provided options
   */
  start(options = {}) {
    if (this._started) {
      return console.log(`${options.id || this.options.id} is already started`);
    }

    if (Array.isArray(options.zones)) {
      const validZones = [];

      options.zones.forEach(zone => {
        try {
          validators.validateZoneDefinition(zone);
          validZones.push(zone);
        } catch (err) {
          this._emitEventMessage('error', err.message);
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

    this._started = true;

    setTimeout(this._update.bind(this), this.options.updateInterval);
  }

  /**
   * Shuts down the connector
   */
  shutdown() {
    this._started = false;
  }
}

const processInstance = isChildProcess ? new WiserConnector() : null;

module.exports = {
  event,
  createOptions,
  createConnector: () => new WiserConnector()
};
