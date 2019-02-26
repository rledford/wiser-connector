'use strict';

const { WiserConnector } = require('../dist');

const connector = new WiserConnector();

const {
  HOSTNAME,
  PORT,
  TAG_HEARTBEAT,
  TAG_SAMPLE_RATE,
  TLS_ENABLED
} = process.env;

connector.on('error', err => {
  console.log(err);
});
connector.on('tagZoneChanged', tag => {
  console.log('tag zone changed', tag);
});
connector.on('tagHeartbeat', transition => {
  console.log('tag heartbeat', transition);
});

connector.start({
  hostname: HOSTNAME || '127.0.0.1',
  tlsEnabled: TLS_ENABLED === 'true',
  port: PORT ? parseInt(PORT) : 3101,
  tagHeartbeat: TAG_HEARTBEAT || 1000,
  tagSampleRate: TAG_SAMPLE_RATE || 1000
});
