# Orbital Web Service for Modeling

Web facing interface for Orbital agent based modeling/simulations service.

Features:

	- backed by orbital agent based models foundation
	- real geographical data
	- users sign in using socials and or web3 auth; giving them control over data
	- users can spin up digital twins of local, bioregional or world issues
	- playtest and share with others (jupyter notebooks style)
	- mix and match tools, data, agents with other users

## Running

See [website/README.md](website/README.md) for full setup including local HTTPS (required for sign-in).

```sh
npm run build
npm run start
```

## Scenario data

Scenarios require geographic datasets not included in the repository (gitignored, too large).

```sh
node scripts/fetch-data.mjs   # download declared assets locally
bash scripts/sync-data.sh     # push local data to the remote server
```

See [website/README.md § Scenario data](website/README.md) for details.