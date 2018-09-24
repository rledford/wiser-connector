'use strict';

const http = require('http');

const DEFAULT_TIMEOUT = 5000;

function getJSON(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
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

module.exports = {
  isServerAvailable,
  passiveTagReport,
  getZones
};
