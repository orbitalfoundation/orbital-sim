April 17, 2026

# Simulation Architecture Sketch (V1)

This page captures a practical architecture to start running scenarios now while staying compatible with more advanced tooling later.

## Goals

- Keep simulation runs deterministic and reproducible.
- Run the whole simulation in RAM for speed and lower write cost.
- Support stateful agents, event-driven behavior, and spatial proximity interactions.
- Allow births/deaths (spawn/despawn) without inconsistent iteration behavior.
- Use folder-backed manifests so scenarios are easy to version and share.

## Folder and Manifest Model

Scenario root example:

- public/anselm/tuvalu/baseline/
  - manifest.json
  - agents/person.js
  - agents/goat.js

Manifest responsibilities:

- Enumerate agent modules and paths.
- Declare initial instances and initial state.
- Define initial events.
- Set global run-space settings (example: spatial cell size).

This supports mixing modules from other projects by path reference. To avoid drift across time, pin imports by version/hash in a future iteration.

## Agent Contract (V1)

Each agent module exports a default object with at least:

- step(context) -> returns patch/position updates and optional lifecycle/event outputs.

Optional:

- onEvents(context) -> processes inbox events and returns patches/emits/spawns/despawn intents.

Agent data shape at runtime:

- id
- type
- state (mutable)
- params (mostly static)
- position (x, y)
- tags

## Tick Engine and Determinism

Per tick:

1. Freeze read state for all agents.
2. Build spatial hash from the read state.
3. Pull events scheduled for this tick.
4. For each agent (stable deterministic order):
   - Run onEvents with inbox.
   - Run step with read-only world view.
   - Collect outgoing events (scheduled to future ticks).
   - Collect spawn/despawn requests.
5. Commit writes to next-state buffer.
6. Apply spawn/despawn changes at boundary.
7. Swap buffers.

Key invariant: all agents read from the same frozen snapshot during a tick.

This avoids partial update bugs where later agents see already-mutated values.

## Event Model

Use a tick-scoped queue, not an immediate async pub/sub bus.

- Events emitted at tick T are scheduled to T+delay, where delay >= 1.
- Delivery is deterministic and phase-bounded.
- Targets can be specific ids or broadcast (*).

This keeps ordering explicit and reproducible.

## Spatial Model

Use a spatial hash grid:

- Map each agent to a cell by floor(position / cellSize).
- Neighbor query checks nearby cells only.
- Proximity logic stays cheap enough for larger populations.

This is a good default before considering R-trees or GPU acceleration.

## Lifecycle (Birth/Death)

Lifecycle operations are staged:

- Agents request spawn/despawn during compute phases.
- Engine applies all structure changes in commit phase only.
- New agents become active on next tick.

No in-loop mutation of the active collection.

## Runtime and Artifacts

Runtime path:

- Inhale scenario from manifest folder.
- Run in-memory for N ticks.
- Emit run artifact at end (metrics + final state + metadata).

Persistence is mostly inputs and outputs, not per-step state writes.

## NPM Workflow

- npm run sim:validate -- --scenario <path>
- npm run sim:run -- --scenario <path> --ticks 365 --seed 42
- npm run sim:report [-- --run-id <id>]

## Is This at Odds with 3100-sim-approaches?

Short answer: no. It is aligned and complementary.

The architecture here is a simulation execution substrate. The approaches in 3100 are modeling paradigms and tool categories. They can stack:

- Agent-based modeling (ABM): directly supported by this architecture.
- System dynamics (stocks/flows): can be represented as specialized aggregate agents or system-level operators.
- Network/graph models: can be represented by agent links and edge states in manifest/state.
- Input-output / CGE style layers: can run as a coupled macro layer per tick, feeding prices/constraints into agents.

So 3200 defines how to execute; 3100 discusses what classes of models to express.

## Near-Term Extensions

- Add version/hash pinning for cross-project agent imports.
- Add conflict resolution hooks for contested resources.
- Add sparse checkpointing and replay mode.
- Add run profiles for "micro ABM" vs "coarse macro" scenarios.
- Add calibration hooks and Monte Carlo batch runner.
