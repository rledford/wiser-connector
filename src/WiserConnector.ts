import { EventEmitter } from 'events';
import { Arena, Tag, Zone, ZoneTransition, ConnectorOptions } from './types';
import { getZoneTransitions, uniqueFilterTagReport } from './helpers';
import { getArena, getZones, getPassiveTagReport } from './requests';

const isChildProcess = typeof process.send === 'function';
const defaultOptions: ConnectorOptions = {
  id: 'WiserConnector',
  hostname: '127.0.0.1',
  port: 3101,
  tlsEnabled: false,
  tagSampleRate: 1000,
  tagHeartbeat: 60000
};
const requestErrorDelay = 5000;
const maxRequestErrorDelayMultiplier = 5;
let requestErrorDelayMultiplier = 0;

class WiserConnector extends EventEmitter {
  private id: string;
  private hostname: string;
  private port: number;
  private tlsEnabled: boolean;
  private tagSampleRate: number;
  private tagHeartbeat: number;
  private started: boolean;
  private trackerTags: { [prop: string]: Tag };
  private trackerZones: Zone[];
  private tagHeartbeats: { [prop: string]: number };
  private tagSampleTimeoutHandle: number;
  public static events = {
    tagHeartbeat: 'tagHeartbeat',
    tagZoneChanged: 'tagZoneChanged',
    status: 'status',
    error: 'error'
  };

  constructor() {
    super();

    this.id = 'WiserConnector';
    this.hostname = '127.0.0.1';
    this.port = 3101;
    this.tlsEnabled = false;
    this.tagSampleRate = 1000;
    this.tagHeartbeat = 60000;
    this.started = false;
    this.trackerTags = {};
    this.trackerZones = [];
    this.tagHeartbeats = {};
    this.tagSampleTimeoutHandle = -1;

    if (isChildProcess && processInstance !== null) {
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

  getId(): string {
    return this.id;
  }
  getHostname(): string {
    return this.hostname;
  }
  getPort(): number {
    return this.port;
  }
  isTLSEnabled(): boolean {
    return this.tlsEnabled;
  }
  isStarted() {
    return this.started;
  }

  private __emitEventMessage(event: string, message: any) {
    if (event === 'error ' && this.listenerCount('error') === 0) {
      return;
    }
    if (isChildProcess && process.send) {
      process.send({
        event,
        data: message
      });
    } else {
      this.emit(event, message);
    }
  }

  private async __update() {
    if (!this.started) return;

    let tagReport: Tag[] = [];
    let zones: Zone[] = [];
    let delayNextUpdate = false;

    try {
      tagReport = await getPassiveTagReport(this);
      zones = await getZones(this);
    } catch (err) {
      this.__emitEventMessage('error', err);
      delayNextUpdate = true;
    }

    if (zones.length) {
      let strIdList: string[] = [];

      zones.forEach(zone => {
        strIdList.push(`${zone.id}`);
        if (this.trackerZones[zone.id]) {
          Object.assign(this.trackerZones[zone.id], zone);
        } else {
          this.trackerZones[zone.id] = zone;
        }
      });

      for (let id in this.trackerZones) {
        if (strIdList.indexOf(id) === -1) {
          delete this.trackerZones[id];
        }
      }
    }

    if (tagReport) {
      uniqueFilterTagReport(tagReport);

      tagReport.forEach(tag => {
        const current: Tag = this.trackerTags[tag.tag];
        if (current) {
          const lastZoneIdList: number[] = current.zones.map(z => z.id);
          const nextZoneIdList: number[] = tag.zones.map(z => z.id);

          if (current.timestamp < tag.timestamp) {
            let transitions = getZoneTransitions(
              lastZoneIdList,
              nextZoneIdList
            );

            transitions.enter.forEach(id => {
              if (this.trackerZones[id] && this.trackerZones[id].name) {
                const { name } = this.trackerZones[id];
                const transition: ZoneTransition = {
                  type: 'enter',
                  tag: tag,
                  zone: { name, id }
                };
                this.__emitEventMessage(
                  WiserConnector.events.tagZoneChanged,
                  transition
                );
              }
            });

            transitions.exit.forEach(id => {
              if (this.trackerZones[id] && this.trackerZones[id].name) {
                const { name } = this.trackerZones[id];
                const transition: ZoneTransition = {
                  type: 'exit',
                  tag: tag,
                  zone: { name, id }
                };
                this.__emitEventMessage(
                  WiserConnector.events.tagZoneChanged,
                  transition
                );
              }
            });

            Object.assign(this.trackerTags[tag.tag], tag);

            if (this.tagHeartbeats[tag.tag]) {
              if (
                tag.timestamp - this.tagHeartbeats[tag.tag] >=
                this.tagHeartbeat
              ) {
                this.tagHeartbeats[tag.tag] = tag.timestamp;
                this.__emitEventMessage(
                  WiserConnector.events.tagHeartbeat,
                  tag
                );
              }
            } else {
              this.tagHeartbeats[tag.tag] = tag.timestamp;
            }
          }
        } else {
          this.trackerTags[tag.tag] = tag;
        }
      });
    }

    let nextUpdateTimeout = this.tagSampleRate;
    if (delayNextUpdate) {
      nextUpdateTimeout = requestErrorDelay * requestErrorDelayMultiplier;
      requestErrorDelayMultiplier = Math.min(
        maxRequestErrorDelayMultiplier,
        ++requestErrorDelayMultiplier
      );
    } else {
      requestErrorDelayMultiplier = 1;
    }

    setTimeout(this.__update.bind(this), nextUpdateTimeout);
  }

  async status() {
    try {
      const status: Arena = await getArena(this);
      this.__emitEventMessage(WiserConnector.events.status, status);
    } catch (err) {
      this.__emitEventMessage('error', err);
    }
  }

  start(options: ConnectorOptions) {
    Object.assign(this, defaultOptions, options);
    if (this.started) {
      return;
    }

    this.started = true;

    setTimeout(this.__update.bind(this), this.tagSampleRate);
  }

  shutdown() {
    this.started = false;
    clearTimeout(this.tagSampleTimeoutHandle);
  }
}

const processInstance = isChildProcess ? new WiserConnector() : null;

export { WiserConnector };
