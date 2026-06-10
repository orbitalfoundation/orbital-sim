# Orbital Web Service - 20260609

## Overview

There are many simulation engines, but the focus of Orbital is specifically civic engagement. Features:

	- model reasonably complex real world scenarios for ordinary people
	- make models simple enough for anybody to understand and explore
	- agent based simulations; brute force numerical integration over time
	- llm based simulations as well (in the future)
	- shared data; from many sources; world boundaries, world events, maps
	- digital twins / predictive models regression tested against historical data
	- operate at three scales: local, bioregional, macro or world scale

	- server side simulation core to allow for millions of agents to be simulated
	- web interface; maps, charts, graphs, time sliders - extremely pretty
	- multiplayer emphasis; jupyter notebooks style

	- user authentication can use web3 so users own their own data
	- dockerized; with inter-docker data/state persistence between reloads
	- modular; not monolithic code base

## Running

See [website/README.md](website/README.md) for full setup including local HTTPS (required for sign-in).

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

