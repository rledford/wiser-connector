import { EventEmitter } from 'events';
import {
  Arena,
  Tag,
  Zone,
  ZoneTransitionEvent,
  ConnectorOptions
} from './types';
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
  private checkConnectionLock: boolean = false;
  private trackerTags: { [prop: string]: Tag } = {};
  private trackerZones: Zone[] = [];
  private tagHeartbeats: { [prop: string]: number } = {};
  private tagSampleTimeoutHandle: any;
  private zoneSampleTimeoutHandle: any;
  private checkConnectionIntervalHandle: any;
  private connectionReady = false;
  private static processInstance: WiserConnector;
  public static events = {
    tagHeartbeat: 'tagHeartbeat',
    tagEnteredZone: 'tagEnteredZone',
    tagExitedZone: 'tagExitedZone',
    status: 'status',
    error: 'error'
  };

  public static getProcessInstance(): WiserConnector {
    if (!WiserConnector.processInstance) {
      WiserConnector.processInstance = new WiserConnector();
    }
    return WiserConnector.processInstance;
  }

  constructor(options: ConnectorOptions = {}) {
    super();
    Object.assign(this, defaultOptions, options);
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

  private emitEventMessage(event: string, message: any) {
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

  private async checkConnection() {
    if (this.checkConnectionLock) return;
    this.checkConnectionLock = true;
    if (!this.connectionReady && (await isServerAvailable(this))) {
      clearTimeout(this.zoneSampleTimeoutHandle);
      clearTimeout(this.tagSampleTimeoutHandle);
      this.connectionReady = true;
      this.zoneSampleTimeoutHandle = setTimeout(this.sampleZones.bind(this), 1);
      this.tagSampleTimeoutHandle = setTimeout(this.sampleTags.bind(this), 1);
    }
    this.checkConnectionLock = false;
  }

  private async sampleZones() {
    if (!this.started || !this.connectionReady) return;
    let zones: Zone[] = [];

    try {
      zones = await getZones(this);
    } catch (err) {
      this.emitEventMessage('error', err);
      this.connectionReady = false;
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
      this.sampleZones.bind(this),
      this.zoneSampleRate
    );
  }

  private createTag(tag: Tag): Tag {
    const t: Tag = Object.assign({}, tag);
    t.zones = [];
    t.timestamp = 0;
    this.trackerTags[tag.tag] = tag;
    return t;
  }

  private async sampleTags() {
    if (!this.started || !this.connectionReady) return;
    let tagReport: Tag[] = [];

    try {
      tagReport = await getPassiveTagReport(this);
    } catch (err) {
      this.emitEventMessage('error', err);
      this.connectionReady = false;
      return;
    }

    if (tagReport.length) {
      tagReport = uniqueFilterTagReport(tagReport);

      tagReport.forEach(report => {
        const current: Tag =
          this.trackerTags[report.tag] || this.createTag(report);
        const lastZoneIdList: number[] = current.zones.map(z => z.id);
        const nextZoneIdList: number[] = report.zones.map(z => z.id);

        if (current.timestamp < report.timestamp) {
          let transitions = getZoneTransitions(lastZoneIdList, nextZoneIdList);

          if (transitions.enter.length || transitions.exit.length) {
            this.tagHeartbeats[report.tag] = report.timestamp;
            transitions.exit.forEach(id => {
              if (this.trackerZones[id] && this.trackerZones[id].name) {
                const { name } = this.trackerZones[id];
                const transition: ZoneTransitionEvent = {
                  report: report,
                  zone: { name, id }
                };
                this.emitEventMessage(
                  WiserConnector.events.tagExitedZone,
                  transition
                );
              }
            });

            transitions.enter.forEach(id => {
              if (this.trackerZones[id] && this.trackerZones[id].name) {
                const { name } = this.trackerZones[id];
                const transition: ZoneTransitionEvent = {
                  report: report,
                  zone: { name, id }
                };
                this.emitEventMessage(
                  WiserConnector.events.tagEnteredZone,
                  transition
                );
              }
            });
          }

          Object.assign(this.trackerTags[report.tag], report);

          if (this.tagHeartbeats[report.tag]) {
            if (
              report.timestamp - this.tagHeartbeats[report.tag] >=
              this.tagHeartbeat
            ) {
              this.tagHeartbeats[report.tag] = report.timestamp;
              this.emitEventMessage(WiserConnector.events.tagHeartbeat, report);
            }
          } else {
            this.tagHeartbeats[report.tag] = report.timestamp;
          }
        }
      });
    }

    this.tagSampleTimeoutHandle = setTimeout(
      this.sampleTags.bind(this),
      this.tagSampleRate
    );
  }

  async status() {
    try {
      const status: Arena = await getArena(this);
      if (isChildProcess) {
        this.emit(WiserConnector.events.status, status);
      } else {
        return status;
      }
    } catch (err) {
      if (isChildProcess) {
        this.emit(WiserConnector.events.error, err);
      } else {
        throw err;
      }
    }
  }

  start(options: ConnectorOptions = {}) {
    Object.assign(this, defaultOptions, options);
    if (this.started) {
      return;
    }
    this.connectionReady = false;
    this.started = true;
    this.checkConnectionIntervalHandle = setInterval(
      this.checkConnection.bind(this),
      1000
    );
  }

  shutdown() {
    clearInterval(this.checkConnectionIntervalHandle);
    clearTimeout(this.zoneSampleTimeoutHandle);
    clearTimeout(this.tagSampleTimeoutHandle);
    this.connectionReady = false;
    this.started = false;
  }
}

if (isChildProcess) {
  const connector = WiserConnector.getProcessInstance();
  process.on('message', message => {
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
        this.emitEventMessage('error', `Unknown command [ ${command} ]`);
    }
  });
}
