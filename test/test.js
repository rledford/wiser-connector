'use strict';

const wc = require('../lib/wiser-connector');

const connector = wc.createConnector();

const { HOSTNAME, PORT } = process.env;

// two adjacent zones that are 100x100 inches
const zones = [
  {
    name: 'Custom Zone A',
    color: '#333',
    shape: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
  },
  {
    name: 'Custom Zone B',
    color: '#f5f5f5',
    shape: [
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 100 },
      { x: 100, y: 100 }
    ]
  }
];

connector.on('error', err => {
  console.log(err);
});
connector.on('tagUpdate', tag => {
  console.log('tag update', tag);
});
connector.on('zoneTransition', transition => {
  console.log('tag zone transition', transition);
});

connector.start({
  hostname: HOSTNAME || '127.0.0.1',
  port: PORT ? parseInt(PORT) : 3101,
  reportZoneTransitions: true,
  reportTagUpdates: false,
  updateInterval: 2000,
  zones
});
