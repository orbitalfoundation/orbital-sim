# Orbital-sim — session log — 2026-07-15 — Primer refresh + devlog start

First `devlog/` entry for this repo. Records how the **primer** (the downloadable
book) is built elsewhere and published here, so the next person doesn't have to
re-derive the wiring.

## What shipped

- **Live:** https://orbital-sim.exe.xyz · **Repo:** https://github.com/orbitalfoundation/orbital-sim
- Refreshed the "Read the primer" download to the v0.4 build (reworked preface with
  the grounded Altadena/Palisades fire opener). PDF + DOCX updated in place.

## How the primer connects to this site

- The book source lives in the **separate `orbital-primer` repo**, not here. It builds
  with pandoc + xelatex (`make pdf docx`; see that repo's
  `primer-devlog/20260715-build-and-deploy-conventions.md` for the full pipeline).
- The built artifacts are checked in here as static files:
  - `public/primer/simulate-the-world.pdf`  ← the Makefile emits `...-print.pdf`; renamed on copy
  - `public/primer/simulate-the-world.docx`
- Surfaced by the home page: `website/client/src/routes/Home.svelte` links
  `/primer/simulate-the-world.pdf` ("Read the primer"). Only the PDF is linked.
- `public/` is served statically by Fastify (`website/server/index.js`), so these are
  plain downloads — no build step here depends on them.

## Publishing = commit + push

The exe.dev VM cron (`scripts/deploy.sh`, see `DEPLOY.md`) polls git once a minute,
pulls, rebuilds the Docker image, restarts the container. So updating the primer is
just: rebuild in `orbital-primer`, copy the two files into `public/primer/`, commit,
push. Verify the live flip with:

```sh
curl -sI https://orbital-sim.exe.xyz/primer/simulate-the-world.pdf | grep -i content-length
```

This session: `4295556` (old) → `4303351` (new).

## Note on scope
Changes to this repo are usually minimal — it's a showcase site, and the interesting
churn is in `orbital-primer` (the book) and the sim/agent packages. Keep this devlog
for site-level wiring and deploy notes; author-side book process stays in the primer repo.
