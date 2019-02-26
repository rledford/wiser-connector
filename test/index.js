'use strict';

const { WiserConnector, eventType } = require('../dist');

const connector = new WiserConnector();

const { HOSTNAME, PORT } = process.env;
const TLS_ENABLED = process.env.TLS_ENABLED === 'true' ? true : false;

connector.on('error', err => {
  console.log(err);
});
connector.on('tagZoneChanged', tag => {
  console.log('tag zone changed', tag);
});
connector.on('tagHeartbeat', transition => {
  console.log('tag heartbeat', transition);
});

connector.start({ tagHeartbeat: 10000, tagSampleRate: 1000 });
