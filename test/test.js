'use strict';

const wc = require('../lib/wiser-connector');

const connector = wc.createConnector();

// two adjacent zones that are 100x100 inches
const zones = [
  {
    name: 123,
    shape: []
  },
  {
    name: 'Custom Zone A',
    shape: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 }
    ]
  },
  {
    name: 'Custom Zone B',
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
  //console.log('tag update', tag);
});
connector.on('tagZoneTransition', transition => {
  console.log('tag zone transition', transition);
});

connector.start({
  reportTagZoneTransitions: true,
  reportTagUpdates: false,
  updateInterval: 2000,
  zones
});
