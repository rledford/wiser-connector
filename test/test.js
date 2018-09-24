'use strict';

const wc = require('../lib/wiser-connector');

const connector = wc.createConnector();

connector.on('tagUpdate', tag => {
  console.log('tag update', tag);
});
connector.on('tagZoneTransition', transition => {
  console.log('tag zone transition', transition);
});

connector.start({ reportTagZoneTransitions: false });
