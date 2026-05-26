# Simulation Engine

Standalone, manifest-driven simulation runtime.

## Install

From this folder:

npm install

## Commands

Validate a scenario manifest:

npm run sim:validate -- --scenario ../../public/anselm/tuvalu/baseline

Run a simulation:

npm run sim:run -- --scenario ../../public/anselm/tuvalu/baseline --ticks 365 --seed 42

Summarize latest run artifact:

npm run sim:report

## Default Behavior

- Default scenario: ../../public/anselm/tuvalu/baseline
- Default output: ../../runs/sim
- Tick engine uses double-buffered state and a tick-scoped event queue.
