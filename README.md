# Orbital Simulation Service

May 30 2026

A modular agent based simulation scaffold with a focus on environmental modeling with a few features:

- Agents themselves are ideally smaller behaviors leveraging provided capabilities
- Allows late binding of agents where agents can self register in a publish subscribe pattern
- A declarative grammar can be used to describe scenarios
- We provide some agents for dealing with elevation, solar irradiation and so on
- A multiplayer focus with a shared workspace

## Running

```sh
# Run all tests
npm test

# A planetary baseline example — 4 ticks of 6 h walks the sun around the planet
node packages/bus/run.js public/anselm/planetary/manifest.js --ticks 4 --dt 21600
```

## Brief Reference Notes

More complete documentation is elsewhere but briefly this is how the pub/sub system registers agents:

`bus.resolve(event)` is the single entry point. Agents are objects with `resolve(event, bus)`. The bus walks its resolver list; handlers whose filter matches are called in order. A handler that returns a non-undefined value stops the chain — this doubles as a query mechanism.

Manifests are ESM files. Each named export becomes an entry. Entries with a `resolve` function are registered as agents; all others are dispatched as bus events for component handlers to process. `inherits: './path/or/package'` loads a template and shallow-merges the entry on top.

```js
// fire-and-forget
await bus.resolve({ tick: 1, t: 3600, dt: 3600 })

// query — first handler with an answer wins
const nearby = await bus.resolve({ spatial_query: { near: [-122, 49], radius: 500 } })
```
