## wiser-connector

Samples data from a Wiser Tracker REST API and reports tag location updates and zone transitions.

Targets ES6+.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Connector Options](#connector-options)
- [Tag Properties](#tag-properties)
- [Events](#events)
- [Errors](#errors)

## Install

```bash
npm i -S wiser-connector
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
  tagSampleRate: 500, // tag data will be checked every 0.5 seconds
  zoneSampleRate: 30000, // zone data will be checked every 30 seconds
  tagHeartbeat: 1000, // tag updates are reported at most once per second
  port: 3101
});

// listen for events
connector.on(WiserConnector.events.tagHeartbeat, message => {
  console.log(message);
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
    case 'tagHeartbeat': // same as WiserConnector.events.tagHeartbeat
      console.log(data);
      break;
  }
});

// shutdown the connector
connector.send({
  command: 'shutdown'
});
```

---

## Connector Options

| Name          | Type      | Default          | Description                                                                                  |
| ------------- | --------- | ---------------- | -------------------------------------------------------------------------------------------- |
| id            | `String`  | `WiserConnector` | The identifier to use for the connector.                                                     |
| hostname      | `String`  | `127.0.0.1`      | The hostname to use to connect to the Wiser REST API.                                        |
| port          | `Number`  | `3101`           | The TCP port to use to connect to the Wiser REST API.                                        |
| tlsEnabled    | `Boolean` | `false`          | If true, the connector will use https to connect to the Wiser REST API.                      |
| tagSampleRate | `Number`  | `1000`           | How often the connector should sample tag data (milliseconds).                               |
| zoneSampleRate | `Number` | `30000` | How often the connector should sample zone data (milliseconds). |
| tagHeartbeat  | `Number`  | `60000`          | How often tag location changes are reported (milliseconds), independent of zone transitions. |

_NOTE_: Zone transitions are ALWAYS reported no matter what the `tagHeartbeat` is set to.

---

## Tag Properties

| Property  | Type       | Description                                                                    |
| --------- | ---------- | ------------------------------------------------------------------------------ |
| id        | `Number`   | The unique id of the tag report.                                               |
| error     | `Number`   | The estimated error in location calculation.                                   |
| location  | `Object`   | Location coordinates `{x: Number, y: Number, z: Number}`.                      |
| tag       | `Number`   | An integer used to identify the tag. Usually printed on the tag in hex format. |
| timestamp | `Number`   | Unix time in milliseconds.                                                     |
| battery   | `Number`   | The current battery voltage of the tag. Anything below 2.8 is considered low.  |
| zones     | `[Object]` | A list of zone IDs `{id: number}` that the tag is reported to be in.           |

The location property is an object that contains the x, y, and z coordinates for the tag position.

Example:

```js
{x: 10.2, y: 256.9, z: 34.0}
```

The `zones` property is an array of objects which describes which zones the tag is currently in.

Example:

```js
[{ id: 0 }, { id: 1 }, { id: 2 }];
```

---

## Events

Register for events using the values defined in `WiserConnector.events` or use the event names directly.

### tagHeartbeat

Emitted when a tag updates and the time since the last heartbeat exceeds the configured `tagHeartbeat` value. See [Tag Properties](#tag-properties).

TIP: Setting `tagHeartbeat` to `0` will cause every tag update to be reported.

### tagEnteredZone & tagExitedZone

Emitted when a tag enters or exits a zone. See event data object definition below.

| Property | Type     | Description                                                              |
| -------- | -------- | ------------------------------------------------------------------------ |
| `tag`    | `Object` | The raw tag report data for the tag that transitioned zones.             |
| `zone`   | `Object` | Contains the Wiser id and name of the zone where the transition occured. |

Example

```js
{
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

Emitted after a connector's `status` method or command is executed. The data contains the current hardware status information returned from the Wiser REST API `/wiser/api/arena` endpoint.

```js
// Example
{
  panId: 0,
  anchors: [
    {
      id: 0,
      hardwareId: 0,
      firmwareVersion: '0.0.0',
      health: 'Alive',
      x: 0,
      y: 0,
      z: 0
    }
  ],
  gateways: [
    {
      id: 0,
      ipv4: '127.0.0.1',
      port: 3101,
      x: 0,
      y: 0,
      z: 0
    }
  ],
  adapters: [
    {
      id: 0,
      usbAnchor: 0,
      downstreamAdapter: 0
    }
  ]
}
```

---
