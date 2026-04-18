# Scanner Research Workspace

This repository is a research workspace for building lightweight whole-systems simulations.

The project is organized as independent modules under src, with shared data flowing through MongoDB and scenario manifests.

## Start Here

Primary documentation lives in the wiki:

- [wiki/index.md](wiki/index.md)
- [wiki/3000-simulation.md](wiki/3000-simulation.md)
- [wiki/3200-sim-architecture.md](wiki/3200-sim-architecture.md)

## Repository Layout

- [src/twitter_scanner](src/twitter_scanner): ingest and analyze source material (Twitter archive and live data)
- [src/simulation_engine](src/simulation_engine): deterministic, in-memory simulation runtime
- [public](public): live scenario definitions and agent manifests
- [runs](runs): generated run outputs
- [raw_ingestion_data](raw_ingestion_data): source data exports for ingestion

## Quick Run

Twitter scanner:

- cd src/twitter_scanner
- npm install
- npm run status
- npm run ingest:archive

Simulation engine:

- cd src/simulation_engine
- npm install
- npm run sim:validate -- --scenario ../../public/anselm/tuvalu/baseline
- npm run sim:run -- --scenario ../../public/anselm/tuvalu/baseline --ticks 365 --seed 42
- npm run sim:report

## Notes

- Modules are intentionally fairly independent.
- Integration is expected to happen through database collections and scenario/model data.
- Public scenarios are treated as editable, first-class project data.
