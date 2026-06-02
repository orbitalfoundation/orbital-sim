# @orbital/server

HTTP and WebSocket gateway to the orbital bus. Runs simulations server-side and streams tick events to browser clients. Keeps real work in the bus and agent packages — the server is a thin bridge.

## Running

```
node packages/server/index.js
PORT=8080 node packages/server/index.js
```

Serves the project's `public/` tree as static files and exposes a sim API at `/api/sim`.

## REST API

`POST /api/sim` `{ manifest, hz?, dt? }` — start a simulation, returns `{ id }`.
`DELETE /api/sim/:id` — stop a simulation.
`GET /api/sim` — list running simulations.
`GET /api/sim/:id` — status of one simulation.

## WebSocket (socket.io)

Include `/socket.io/socket.io.js` and `/orbital-client.js` in your page, then:

```js
const session = await OrbitalClient.start('public/my/manifest.js', { hz: 1, dt: 3600 });
session.on('tick', ({ tick, t, dt }) => render(t));
session.stop();
```

`OrbitalClient.start` posts to `/api/sim`, subscribes the socket to the sim's room, and returns a `Session` that emits `tick` and `stopped` events.

## Multiplayer vs. solo

Multiple browser tabs can subscribe to the same sim id and receive identical tick events. A solo sim is just a shared sim with one subscriber. The manifest or calling code decides whether to share an id or create a new one per session.
