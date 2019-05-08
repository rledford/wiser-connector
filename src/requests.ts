import * as http from 'http';
import * as https from 'https';
import { Arena, RequestConfig, Zone, Tag } from './types';
import WiserConnector from './WiserConnector';

const DEFAULT_TIMEOUT = 5000;

function getJSON(config: RequestConfig) {
  return new Promise<any>((resolve, reject) => {
    const request: Function = config.tlsEnabled ? https.request : http.request;
    const req = request(config, res => {
      res.setEncoding('utf8');

      const body: any[] = [];

      res.on('data', (chunk: any) => {
        body.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode) {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              `GET error - server responded with status code ${res.statusCode}`
            );
          }
        }

        try {
          resolve(JSON.parse(body.join('')));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.setTimeout(DEFAULT_TIMEOUT, () => {
      reject('request timeout');
    });

    req.on('error', err => {
      reject(err);
    });

    req.end();
  });
}

function postJSON(config: RequestConfig, data: object) {
  return new Promise<any>((resolve, reject) => {
    let payload;

    if (typeof data !== 'string') {
      payload = JSON.stringify(data);
    } else if (typeof data === 'undefined') {
      return reject('missing data');
    }

    const request: Function = config.tlsEnabled ? https.request : http.request;

    const req = request(config, res => {
      res.setEncoding('utf8');

      const body: any[] = [];

      res.on('data', (chunk: any) => {
        body.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode) {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              `POST error - server responded with status code ${res.statusCode}`
            );
          }
        }

        resolve(res.statusCode);
      });
    });

    req.setTimeout(DEFAULT_TIMEOUT, () => {
      reject('request timeout');
    });

    req.on('error', (err: any) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

function isServerAvailable(connector: WiserConnector): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const config: any = {
      method: 'GET',
      hostname: connector.getHostname(),
      port: connector.getPort(),
      path: '/wiser/api',
      tlsEnabled: connector.isTLSEnabled()
    };

    const request: Function = connector.isTLSEnabled()
      ? https.request
      : http.request;

    const req = request(config, (res: any) => {
      res.on('data', (data: any) => {});

      res.on('end', () => {
        if (res.statusCode) {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              `GET error - server responded with status code ${res.statusCode}`
            );
          }
        }

        resolve(true);
      });
      res.on('error', (err: any) => {
        reject(err);
      });
    });

    req.setTimeout(DEFAULT_TIMEOUT, () => {
      reject('request timeout');
    });

    req.on('error', (err: any) => {
      reject(err);
    });

    req.end();
  });
}

function getPassiveTagReport(connector: WiserConnector): Promise<Tag[]> {
  return getJSON({
    method: 'GET',
    hostname: connector.getHostname(),
    port: connector.getPort(),
    tlsEnabled: connector.isTLSEnabled(),
    path: '/wiser/api/passivetagreport',
    headers: {
      Accept: 'application/json'
    }
  });
}

function getArena(connector: WiserConnector): Promise<Arena> {
  return getJSON({
    method: 'GET',
    hostname: connector.getHostname(),
    port: connector.getPort(),
    tlsEnabled: connector.isTLSEnabled(),
    path: '/wiser/api/arena',
    headers: {
      Accept: 'application/json'
    }
  });
}

function getZones(connector: WiserConnector): Promise<Zone[]> {
  return getJSON({
    method: 'GET',
    hostname: connector.getHostname(),
    port: connector.getPort(),
    tlsEnabled: connector.isTLSEnabled(),
    path: '/wiser/api/zone',
    headers: {
      Accept: 'application/json'
    }
  });
}

function createZone(connector: WiserConnector, zone: Zone) {
  return postJSON(
    {
      method: 'POST',
      hostname: connector.getHostname(),
      port: connector.getPort(),
      tlsEnabled: connector.isTLSEnabled(),
      path: '/wiser/api/zone'
    },
    zone
  );
}

export {
  isServerAvailable,
  getPassiveTagReport,
  getArena,
  getZones,
  createZone
};
