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

## A note regarding scenario data for some scenarios:

At the moment GEBCO (world elevation data) is too large to fetch ahead of time. Other datasets are fetched dynamically. We have a utility for scenarios requiring geographic datasets not included in the repository (gitignored, too large). @todo revisit - try automate.

```sh
node scripts/fetch-data.mjs   # download declared assets locally
bash scripts/sync-data.sh     # push local data to the remote server
```

