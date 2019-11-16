'use strict';

const WiserConnector = require('../dist');

const {
  HOSTNAME,
  PORT,
  TAG_HEARTBEAT,
  TAG_SAMPLE_RATE,
  ZONE_SAMPLE_RATE,
  TLS_ENABLED
} = process.env;

const options = {
  hostname: HOSTNAME || '127.0.0.1',
  tlsEnabled: TLS_ENABLED === 'true',
  port: PORT ? parseInt(PORT) : 3101,
  tagHeartbeat: TAG_HEARTBEAT || 1000,
  tagSampleRate: TAG_SAMPLE_RATE || 1000,
  zoneSampleRate: ZONE_SAMPLE_RATE || 10000
};

const connector = new WiserConnector(options);

connector.on('error', err => {
  console.log(err);
});
connector.on('tagExitedZone', data => {
  console.log('tag exited zone', data);
});
connector.on('tagEnteredZone', data => {
  console.log('tag entered zone', data);
});
connector.on('tagHeartbeat', tag => {
  console.log('tag heartbeat', tag);
});

connector.start();

setTimeout(() => {
  console.log('SHUTTING DOWN');
  connector.shutdown();
  setTimeout(() => {
    console.log('RESTARTING');
    connector.start(options);
  }, 1000);
}, 10000);
