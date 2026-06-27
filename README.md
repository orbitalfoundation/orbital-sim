# Orbital Web Service - 20260609

## Overview

https://github.com/orbitalfoundation/orbital-sim presents a multiuser website over a collection of simulation and modeling tools for building digital twins of civic issues. It's more intended to showcase the idea of civic modeling than to be a robust modeling framework. That said the sims are run on the server side and could arguably scale.

Features include:

- should be easy and fun to use
- agent based models
- public data
- simulate scenarios at local, regional and macro scale

Technical:

- brute force simulations over time (not llm driven)
- server side simulations
- user authentication can use web3 so users own their own data
- dockerized; with inter-docker data/state persistence between reloads
- modular; not monolithic code base

Future Goals

- llm supported agent creation
- shared data; from many sources; world boundaries, world events, maps
- digital twins / predictive models regression tested against historical data
- web interface; maps, charts, graphs, time sliders - extremely pretty
- multiplayer emphasis; jupyter notebooks style

## Running

See [website/README.md](website/README.md) for full setup including local HTTPS (required for sign-in).
For deployment (Docker, data persistence, auto-deploy — one worked example among many), see [DEPLOY.md](DEPLOY.md). Requires Node 24+ (the server uses the built-in `node:sqlite`).

```sh
npm run build
npm run start
```

See [website/README.md § Scenario data](website/README.md) for more details.

## Scenario data

Large reference datasets are hosted in a separate [orbital-data](https://github.com/orbitalfoundation/orbital-data) repo and fetched automatically on first run — no manual preparation needed for deployment. This includes the downsampled GEBCO elevation raster (18 MB), Fragile States Index, and other shared geo resources. Other datasets (Natural Earth boundaries, GDELT/UCDP events, world cities) are fetched dynamically by their ingestion agents.

```sh
node scripts/fetch-data.mjs   # fetch any declared assets not present locally
```

The only data requiring manual work is regenerating the GEBCO raster from full-resolution source tiles (~7 GB), which is only needed when GEBCO publishes a new yearly release:

```sh
bash scripts/fetch-gebco.sh         # download full tiles from CEDA
node scripts/gebco-downsample.mjs   # regenerate the 18 MB raster
# then update the sha256 in manifests and push to the orbital-data repo
```

See [website/README.md § Scenario data](website/README.md) for full details.

