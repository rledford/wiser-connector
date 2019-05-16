import { EventEmitter } from 'events';
import { Arena, Tag, Zone, ZoneTransition, ConnectorOptions } from './types';
import { getZoneTransitions, uniqueFilterTagReport } from './helpers';
import {
  getArena,
  getZones,
  getPassiveTagReport,
  isServerAvailable
} from './requests';

const isChildProcess = typeof process.send === 'function';
const defaultOptions: ConnectorOptions = {
  id: 'WiserConnector',
  hostname: '127.0.0.1',
  port: 3101,
  tlsEnabled: false,
  tagSampleRate: 1000,
  tagHeartbeat: 60000,
  zoneSampleRate: 30000
};

export default class WiserConnector extends EventEmitter {
  private id: string;
  private hostname: string;
  private port: number;
  private tlsEnabled: boolean;
  private tagSampleRate: number;
  private tagHeartbeat: number;
  private zoneSampleRate: number;
  private started: boolean = false;
  private trackerTags: { [prop: string]: Tag } = {};
  private trackerZones: Zone[] = [];
  private tagHeartbeats: { [prop: string]: number } = {};
  private tagSampleTimeoutHandle: NodeJS.Timeout;
  private zoneSampleTimeoutHandle: NodeJS.Timeout;
  private checkConnectionIntervalHandle: NodeJS.Timeout;
  private serverAvailable = true;
  private static processInstance: WiserConnector;
  public static events = {
    tagHeartbeat: 'tagHeartbeat',
    tagEnteredZone: 'tagEnteredZone',
    tagExitedZone: 'tagExitedZone',
    status: 'status',
    error: 'error'
  };
  private static getProcessInstance(): WiserConnector {
    if (!WiserConnector.processInstance) {
      WiserConnector.processInstance = new WiserConnector();
    }
    return WiserConnector.processInstance;
  }

  constructor() {
    super();
    Object.assign(this, defaultOptions);
    this.checkConnectionIntervalHandle = setInterval(
      this.__checkConnection.bind(this),
      1000
    );

    if (isChildProcess) {
      const connector = WiserConnector.getProcessInstance();
      this.on('message', message => {
        const { command, options } = message;
        switch (command) {
          case 'start':
            connector.start(options);
            break;
          case 'status':
            connector.status();
          case 'shutdown':
            connector.shutdown();
            break;
          default:
            this.__emitEventMessage('error', `Unknown command [ ${command} ]`);
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

  private async __checkConnection() {
    if (!this.serverAvailable && (await isServerAvailable(this))) {
      clearTimeout(this.zoneSampleTimeoutHandle);
      clearTimeout(this.tagSampleTimeoutHandle);
      this.serverAvailable = true;
      this.zoneSampleTimeoutHandle = setTimeout(
        this.__sampleZones.bind(this),
        0
      );
      this.tagSampleTimeoutHandle = setTimeout(this.__sampleTags.bind(this), 0);
    }
  }

  private async __sampleZones() {
    if (!this.started || !this.serverAvailable) return;
    let zones: Zone[] = [];

    try {
      zones = await getZones(this);
    } catch (err) {
      this.__emitEventMessage('error', err);
      this.serverAvailable = false;
      return;
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

    this.zoneSampleTimeoutHandle = setTimeout(
      this.__sampleZones.bind(this),
      this.zoneSampleRate
    );
  }

  private async __sampleTags() {
    if (!this.started || !this.serverAvailable) return;
    let tagReport: Tag[] = [];

    try {
      tagReport = await getPassiveTagReport(this);
    } catch (err) {
      this.__emitEventMessage('error', err);
      this.serverAvailable = false;
      return;
    }

    if (tagReport.length) {
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

            transitions.exit.forEach(id => {
              if (this.trackerZones[id] && this.trackerZones[id].name) {
                const { name } = this.trackerZones[id];
                const transition: ZoneTransition = {
                  tag: tag,
                  zone: { name, id }
                };
                this.__emitEventMessage(
                  WiserConnector.events.tagExitedZone,
                  transition
                );
              }
            });

            transitions.enter.forEach(id => {
              if (this.trackerZones[id] && this.trackerZones[id].name) {
                const { name } = this.trackerZones[id];
                const transition: ZoneTransition = {
                  tag: tag,
                  zone: { name, id }
                };
                this.__emitEventMessage(
                  WiserConnector.events.tagEnteredZone,
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

    this.tagSampleTimeoutHandle = setTimeout(
      this.__sampleTags.bind(this),
      this.tagSampleRate
    );
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

    this.zoneSampleTimeoutHandle = setTimeout(
      this.__sampleZones.bind(this),
      500
    );
    this.tagSampleTimeoutHandle = setTimeout(
      this.__sampleTags.bind(this),
      1000
    );
    this.checkConnectionIntervalHandle = setTimeout(
      this.__checkConnection.bind(this),
      0
    );
  }

  shutdown() {
    this.started = false;
    clearInterval(this.checkConnectionIntervalHandle);
    clearTimeout(this.zoneSampleTimeoutHandle);
    clearTimeout(this.tagSampleTimeoutHandle);
  }
}
