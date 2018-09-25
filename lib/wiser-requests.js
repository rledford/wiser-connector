'use strict';

const http = require('http');
const qs = require('querystring');

const DEFAULT_TIMEOUT = 5000;

function getJSON(options) {
  return new Promise((resolve, reject) => {
    options.method = 'GET';
    options.headers = {
      Accept: 'application/json'
    };

    const req = http.request(options, res => {
      res.setEncoding('utf8');

      const body = [];

      res.on('data', chunk => {
        body.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(`server responded with status code ${res.statusCode}`);
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

function postJSON(options, data) {
  return new Promise((resolve, reject) => {
    options.method = 'POST';
    options.headers = {
      'Content-Type': 'application/json'
    };

    let payload;

    if (typeof data !== 'string') {
      payload = JSON.stringify(data);
    } else if (typeof data === 'undefined') {
      return reject('missing data');
    }

    //options.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = http.request(options, res => {
      res.setEncoding('utf8');

      const body = [];

      res.on('data', chunk => {
        body.push(chunk);
      });

      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(`server responded with status code ${res.statusCode}`);
        }

        resolve(res.statusCode);
      });
    });

    req.setTimeout(DEFAULT_TIMEOUT, () => {
      reject('request timeout');
    });

    req.on('error', err => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

/**
 * GET - wiser api endpoint to check availablility
 * @param {*} options - hostname, port
 */
function isServerAvailable(options) {
  return new Promise((resolve, reject) => {
    const { hostname, port } = options;

    const req = http.request(
      {
        hostname,
        port,
        path: '/wiser/api'
      },
      res => {
        res.on('data', data => {});

        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              `server responded with status code ${res.statusCode}`
            );
          }

          resolve(true);
        });
        res.on('error', err => {
          reject(err);
        });
      }
    );

    req.setTimeout(DEFAULT_TIMEOUT, () => {
      reject('request timeout');
    });

    req.on('error', err => {
      reject(err);
    });

    req.end();
  });
}

/**
 * GET - tag reports
 * @param {*} options - hostname, port
 */
function passiveTagReport(options) {
  const { hostname, port } = options;
  return getJSON({
    hostname,
    port,
    path: '/wiser/api/passivetagreport',
    headers: {
      Accept: 'application/json'
    }
  });
}

/**
 * GET - zone definitions
 * @param {*} options - hostname, port
 */
function getZones(options) {
  const { hostname, port } = options;
  return getJSON({
    hostname,
    port,
    path: '/wiser/api/zone',
    headers: {
      Accept: 'application/json'
    }
  });
}

/**
 * POST - create zone
 */
function createZone(options, zone) {
  const { hostname, port } = options;
  return postJSON(
    {
      hostname,
      port,
      path: '/wiser/api/zone'
    },
    zone
  );
}

module.exports = {
  isServerAvailable,
  passiveTagReport,
  getZones,
  createZone
};
