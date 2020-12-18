## wiser-connector

Samples data from a Wiser Tracker REST API and reports tag location updates and zone transitions.

Targets ES6+.

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Connector Options](#connector-options)
- [Tag Report Properties](#tag-report-properties)
- [Methods](#methods)
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
const connector = new WiserConnector({
  hostname: '127.0.0.1',
  tagSampleRate: 500, // tag data will be checked every 0.5 seconds
  zoneSampleRate: 30000, // zone data will be checked every 30 seconds
  tagHeartbeat: 1000, // tag updates are reported at most once per second
  port: 3101
});

// start the connector
connector.start();

// listen for events
connector.on(WiserConnector.events.tagHeartbeat, message => {
  console.log(message);
});

// shutdown the connector
connector.shutdown();
```

---

## Connector Options

| Name           | Type      | Default          | Description                                                                                  |
| -------------- | --------- | ---------------- | -------------------------------------------------------------------------------------------- |
| id             | `String`  | `WiserConnector` | The identifier to use for the connector.                                                     |
| hostname       | `String`  | `127.0.0.1`      | The hostname to use to connect to the Wiser REST API.                                        |
| port           | `Number`  | `3101`           | The TCP port to use to connect to the Wiser REST API.                                        |
| tlsEnabled     | `Boolean` | `false`          | If true, the connector will use https to connect to the Wiser REST API.                      |
| tagSampleRate  | `Number`  | `1000`           | How often the connector should sample tag data (milliseconds).                               |
| zoneSampleRate | `Number`  | `30000`          | How often the connector should sample zone data (milliseconds).                              |
| tagHeartbeat   | `Number`  | `60000`          | How often tag location changes are reported (milliseconds), independent of zone transitions. |

_NOTE_: Zone transitions are ALWAYS reported no matter what the `tagHeartbeat` is set to.

---

## Tag Report Properties

| Property  | Type       | Description                                                                    |
| --------- | ---------- | ------------------------------------------------------------------------------ |
| id        | `Number`   | The unique id of the tag report.                                               |
| error     | `Number`   | The estimated error in location calculation.                                   |
| location  | `Object`   | Location coordinates `{x: Number, y: Number, z: Number}`.                      |
| tag       | `Number`   | An integer used to identify the tag. Usually printed on the tag in hex format. |
| timestamp | `Number`   | Unix time in milliseconds.                                                     |
| battery   | `Number`   | The current battery voltage of the tag. Anything below 2.8 is considered low.  |
| zones     | `Object[]` | A list of zone IDs `{id: number}` that the tag is reported to be in.           |

The location property is an object that contains the x, y, and z coordinates for the tag position.

Example:

```js
{x: 10.2, y: 256.9, z: 34.0}
```

The `zones` property is an array of objects that describe which zones the tag is currently in.

Example:

```js
[{ id: 0 }, { id: 1 }, { id: 2 }];
```

## Anchor Properties

| Property        | Type      | Description                   |
| --------------- | --------- | ----------------------------- |
| id              | `Integer` | Anchor ID                     |
| hardwareId      | `Integer` | Hardware ID                   |
| firmwareVersion | `String`  | Firmware version              |
| x               | `Number`  | X coordinate within the array |
| y               | `Number`  | Y coordinate within the array |
| z               | `Number`  | Z coordinate within the array |

## Gateway Properties

| Property | Type      | Description                   |
| -------- | --------- | ----------------------------- |
| id       | `Integer` | Gateway ID                    |
| ipv4     | `String`  | Network IP address            |
| port     | `Integer` | Network TCP port              |
| x        | `Number`  | X coordinate within the array |
| y        | `Number`  | Y coordinate within the array |
| z        | `Number`  | Z coordinate within the array |

## Adapter Properties

| Property          | Type      | Description            |
| ----------------- | --------- | ---------------------- |
| id                | `Integer` | Adapter ID             |
| usbAnchor         | `Integer` | USB attached anchor ID |
| downstreamAdapter | `Integer` | Downstream adapter ID  |

## Arena Properties

| Property | Type        | Description                             |
| -------- | ----------- | --------------------------------------- |
| panId    | `Integer`   | Unique ID                               |
| anchors  | `[Anchor]`  | List of [anchors](#anchor-properties)   |
| gateways | `[Gateway]` | List of [gateways](#gateway-properties) |
| adapters | `[Adapter]` | List of [adapters](#adapter-properties) |

---

## Methods

### start

Start the connector with [Connector Options](#connector-options) or, if not provided, use the options passed to the constructor.

```js
const WiserConnector = require('wiser-connector');
const options = {
  hostname: '192.168.1.9',
  port: 3101,
  tagHeartbeat: 300000
};

const connector = new WiserConnector(options);
connector.start();

// OR

const connector = new WiserConnector();
connector.start(options);
```

### shutdown

Shut down the connector.

```js
connector.shutdown();
```

### status (async)

Returns a `Promise` that resolves to an [Arena](#arena-properties) object.

```js
connector
  .status()
  .then(arena => {
    console.log(arena);
  })
  .catch(err => {
    console.log(err.message);
  });

// OR

try {
  const arena = await connector.status();
} catch (err) {
  console.log(err.message);
}
```

## Events

Register for events using the values defined in `WiserConnector.events` or use the event names directly.

### tagHeartbeat

Emitted when a tag updates and the time since the last heartbeat is greater than or equal to the configured `tagHeartbeat` value. See [Tag Report Properties](#tag-properties).

_TIP_: Setting `tagHeartbeat` to `0` will cause every tag update to be reported.

### tagEnteredZone & tagExitedZone

Emitted when a tag enters or exits a zone. See event data object definition below.

| Property | Type     | Description                                                              |
| -------- | -------- | ------------------------------------------------------------------------ |
| `report` | `Object` | The tag report for the tag that transitioned zones.                      |
| `zone`   | `Object` | Contains the Wiser id and name of the zone where the transition occured. |

Example

```js
{
  report: {
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

Emitted after a connector's `status` command is executed in a child process. The data contains the current hardware status information returned from the Wiser REST API `/wiser/api/arena` endpoint. See [Arena Properties](#arena-properties)

You can also use _async/await_ or _then/catch_ since the `status` method is asynchronous to get the data without subscribing to the `status` event.

```js
// .then/.catch
connector
  .status()
  .then(() => {
    // process arena data
  })
  .catch(err => {
    // handle error
  });

// async/await
try {
  const arena = await connector.status();
  // process arena data
} catch (err) {
  // handle error
}
```

---
