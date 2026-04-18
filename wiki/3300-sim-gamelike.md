April 17, 2026

# 3300 - Simulation as Game-Like Architecture

A useful framing is: this project is close to a simulation-first game engine.

## Core Mapping

- Level -> Scenario folder + manifest
- Prefab/template -> Agent module defaults
- Instance -> Agent state + position + runtime identity
- Game loop -> Fixed-tick simulation engine
- Save/output -> Run artifacts in runs/

## Why This Framing Helps

- Clarifies boundaries between authored content and runtime state.
- Encourages deterministic update phases.
- Makes loading and spatial query patterns more obvious.
- Gives a practical path to scaling with known game patterns.

## Practical Design Implications

1. Keep scenario manifests as level definitions.

- Define world settings, initial instances, and startup events.
- Prefer reusable templates with per-instance overrides.

2. Keep tick phases explicit.

- Read frozen snapshot.
- Build broad-phase spatial index.
- Deliver events.
- Compute intents/patches.
- Resolve conflicts.
- Commit next state.
- Apply spawn/despawn.

3. Prefer system-level operators for shared logic.

- Movement, markets, weather shocks, disease spread, etc.
- Agents stay focused on local state and decisions.

4. Use broad-phase then narrow-phase queries.

- Broad phase: spatial hash/grid for candidate neighbors.
- Narrow phase: exact rule checks (distance, visibility, thresholds).

5. Separate authored data from generated data.

- Authored: public/... scenarios and manifests.
- Generated: runs/... artifacts.

## Relationship Patterns Between Agents

- Query by tags/factions/roles instead of hardcoding many IDs.
- Use direct references only for strong ties (parent-child, ownership).
- Use event channels for looser coupling and clearer causality.

## Loading and Scale

Near-term:

- Load full scenario into RAM for deterministic runs.

Later:

- Chunked/region loading.
- Activation radius or multi-resolution simulation.
- Coarse simulation for distant entities.

## Bottom Line

Treating the simulator like a game engine is not a metaphor only; it is an implementation strategy that improves determinism, modularity, and scalability.
