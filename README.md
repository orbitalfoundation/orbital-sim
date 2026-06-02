# Orbital Simulation Service

Last Rev: 20260601

An agent based simulation scaffold for modeling multi-domain scenarios.

Core layout:

/packages ... core agent scaffolding; pub/sub with late binding agents
/public   ... multiplayer shared space; participants can define agents
/website  ... a helpful web scaffolding for convenient interaction

## Running

See [website/README.md](website/README.md) for full setup including local HTTPS (required for sign-in).

```sh
npm run build
npm run start
```