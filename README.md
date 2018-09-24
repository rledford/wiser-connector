## wiser-connector

Creates a connector to a Wiser REST API and reports tag position updates and zone transitions. The connector can be configured with custom zone definitions that will be sent to the Wiser instance for geofencing.

Targets Node.js 6 or later.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Tag Property Definitions](#tag-property-definitions)
- [Options](#options)
- [Events](#events)
- [Defining Zones](#defining-zones)

## Install

Currently, this is not a published NPM package. If it were, you would use the following to install the package.

```bash
npm install wiser-connector
```

So instead, clone this repository into your `node_modules` folder and `require` as usual.

## Usage

### Same Process

```js
// import module
const wc = require('wiser-connector');

// create connector
const connector = wc.createConnector();

// define options
const options = { hostname: '127.0.0.1', port: 3101 };

// start the connector
connector.start(options);

// listen for events
connector.on('tagUpdate', data => {
  console.log(data);
});

// shutdown the connector
connector.shutdown();
```

### Child Process

```js
// import modules
const fork = require('child_process').fork;
const connector = fork('./node_modules/wiser-connector');

// define options
const options = { hostname: '127.0.0.1', port: 3101 };

// send the start command and options to the connector process
connector.send({
  command: 'start',
  options: options
});

// listen for events
connector.on('message', message => {
  const { event, data } = message;
  switch (event) {
    case 'tagUpdate':
      console.log(data);
      break;
  }
});

// shutdown the connector
connector.send({
  command: 'shutdown'
});
```

## Options

| Name                     | Type      | Default          | Description                                                                                                                                           |
| ------------------------ | --------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| id                       | `String`  | `WiserConnector` | The identifier to use for the connector.                                                                                                              |
| hostname                 | `String`  | `127.0.0.1`      | The hostname to use to connect to the Wiser REST API.                                                                                                 |
| port                     | `Number`  | `3101`           | The TCP port to use to connect to the Wiser REST API.                                                                                                 |
| reportTagUpdates         | `Boolean` | `true`           | Report when a tag updates.                                                                                                                            |
| reportTagZoneTransitions | `Boolean` | `true`           | Report when tags enter or exit zones.                                                                                                                 |
| updateInterval           | `Number`  | `500`            | The time, in milliseconds, that requests will be sent to the Wiser REST API. The requests are only made after the previous request has been processed |
| healthCheckInterval      | `Number`  | `300000`         | The time, in milliseconds, that a health report will be requested from the Wiser REST API.                                                            |
| zones                    | `Array`   | `[]`             | The custom zone definitions that will be sent to the Wiser instance to use for geofencing. See [Defining Zones](#defining-zones).                     |

---

## Tag Property Definitions

| Property    | Type     | Description                                                                    |
| ----------- | -------- | ------------------------------------------------------------------------------ |
| `id`        | `Number` | The unique id of the tag report.                                               |
| `error`     | `Number` | The estimated error in location calculation.                                   |
| `location`  | `Object` | {x: Number, y: Number, z: Number}                                              |
| `tag`       | `Number` | An integer used to identify the tag. Usually printed on the tag in hex format. |
| `timestamp` | `Number` | Unix time in milliseconds.                                                     |
| `battery`   | `Number` | The current battery voltage of the tag. Anything below 2.8 is considered low.  |
| `zones`     | `Array`  | A list of zone IDs that the tag is reported to be in.                          |

The location property is an object literal that defines the x, y, and z coordinates for the tag position.

Example:

```js
{x: 10.2, y: 256.9, z: 34.0}
```

The `zones` property is an array that contains object literals which identify the zone that the tag is detected in. The `id` references the zone's index in the array of zones returned from the `/wiser/api/zone` endpoint.

Example:

```js
[{ id: 0 }, { id: 1 }, { id: 2 }];
```

## Events

### start

Emitted when the connector starts. No Data.

### shutdown

Emitted when the connector shuts down. No Data.

### tagUpdate

Emitted when a tag updates. See [Tag Property Definitions](#tag-property-definitions).

### tagZoneTransition

Emitted when a tag enters or exits a zone. See data definition below.

| Property | Type     | Description                                                  |
| -------- | -------- | ------------------------------------------------------------ |
| `type`   | `String` | Will be either `enter` or `exit`                             |
| `tag`    | `Object` | The raw tag report data for the tag that transitioned zones. |
| `zone`   | `String` | The name of the zone where the transition occured.           |

```js
{
  "type": String;
  tag: Object; // see Tag Property Definitions for details
}
```

## Defining Zones

When creating options for a connector to use, it's possible to provide an array of custom zone definitions that will be sent to the Wiser instance and used for geofencing. Only the zone `name` and `shape` are required used, so providing other options like `id` or `color` are uneccessary (and ignored).

IMPORTANT NOTE: The `id` for custom zones start at `1000`. If the Wiser instance is using a configuration file that has _more than 1000_ zones (highly unlikely), there will be unpredictable issues with the geofencing.

```js
const wc = require('wiser-connector');
const connector = wc.createConnector();

// two adjacent zones that are 100x100 inches
const zones = [
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

connector.start({
  hostname: '127.0.0.1',
  port: 3101,
  zones: zones
});
```
