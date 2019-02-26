## wiser-connector

Creates a connector to a Wiser REST API and reports tag position updates and zone transitions.

Targets ES6+.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Tag Property Definitions](#tag-property-definitions)
- [Options](#options)
- [Events](#events)
- [Defining Zones](#defining-zones)

## Install

```bash
npm install wiser-connector
```

## Usage

### Same Process

```js
// import
const { WiserConnector } = require('wiser-connector');

// create connector
const connector = new WiserConnector();

// start the connector
connector.start({
  hostname: '127.0.0.1',
  sampleRate: 500, // tag data will be checked every 0.5 seconds
  tagHeartbeat: 1000, // tag updates are reported at most once per second
  port: 3101
});

// listen for events
connector.on(WiserConnector.events.tagHeartbeat, data => {
  console.log(data);
});

// stop the connector
connector.stop();
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
    case 'tagHeartbeat': // same as WiserConnector.events.tagHeartbeat
      console.log(data);
      break;
  }
});

// stop the connector
connector.send({
  command: 'stop'
});
```

## Options

| Name          | Type     | Default          | Description                                                                   |
| ------------- | -------- | ---------------- | ----------------------------------------------------------------------------- |
| id            | `String` | `WiserConnector` | The identifier to use for the connector.                                      |
| hostname      | `String` | `127.0.0.1`      | The hostname to use to connect to the Wiser REST API.                         |
| port          | `Number` | `3101`           | The TCP port to use to connect to the Wiser REST API.                         |
| tagSampleRate | `Number` | `1000`           | How often the connector should sample tag data.                               |
| tagHeartbeat  | `Number` | `60000`          | How often tag location changes are reported, independent of zone transitions. |

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

Register for events using the values defined in `WiserConnector.events` or use the event names directly.

### tagHeartbeat

Emitted when a tag updates and the time since the last heartbeat exceeds the configured `tagHeartbeat` value. See [Tag Property Definitions](#tag-property-definitions).

TIP: Settings `tagHeartbeat` to `0` will cause every tag update to be reported.

### tagZoneChanged

Emitted when a tag enters or exits a zone. See data definition below.

| Property | Type     | Description                                                              |
| -------- | -------- | ------------------------------------------------------------------------ |
| `type`   | `String` | Will be either `enter` or `exit`                                         |
| `tag`    | `Object` | The raw tag report data for the tag that transitioned zones.             |
| `zone`   | `Object` | Contains the Wiser id and name of the zone where the transition occured. |

Example

```js
{
  type: 'enter',
  tag: {
    id: 0,
    tag: 31000,
    location: {x: 0, y: 0, z: 0},
    zones: [{id: 0, id: 1}],
    error: 0.0,
    anchors: 5,
    timestamp: 143456789,
    battery: 3.1
  },
  zone: {
    id: 0,
    name: 'Zone A'
  }
}
```

### status

Emitted after a connector's `status` method or command is executed. The data contains the current hardware status information returned from the Wiser REST API.

```js
// Example
```
