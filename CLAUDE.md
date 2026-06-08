# Orbital — brand, design, and technical reference

Single source of truth for design decisions and project context. Claude reads this automatically; humans should look here first.

---

## Name and voice

**Orbital** — the simulation workspace. Implies planetary scale, system dynamics, things in motion around other things.

*Tagline: Simulation as argument. Secondary: Run the numbers. Share the results.*

Voice is sober, precise, direct — peer-reviewed paper, not startup marketing. No exclamation marks. Numbers and outcomes over adjectives. The work speaks.

---

## Colors

| Token | Dark mode | Light mode | Use |
|---|---|---|---|
| `--bg` | `#07070e` | `#f4f4f8` | Page background |
| `--surface` | `#0f0f1c` | `#ffffff` | Cards, panels |
| `--border` | `#1e1e30` | `#e0e0ea` | Dividers |
| `--accent` | `#0fd4bc` | `#0aaa96` | **Primary brand color** |
| `--text` | `#dcdce8` | `#0f0f1c` | Body text |
| `--muted` | `#5a5a7a` | `#8080a0` | Labels, secondary text |

The accent mint-teal is the **primary brand color** — the one color that should feel alive. Use it for interactive highlights, selected states, active indicators. Everything else stays in the dark neutral stack. Reads as scientific instrument: oceanographic charts, satellite data dashboards, climate visualization. Not cyan-aggressive, not green-environmental.

---

## Typography

- UI / prose: `ui-sans-serif, system-ui, sans-serif`
- Data / code / labels: `ui-monospace, monospace`
- No web fonts. System stack only. Fast, no flash of unstyled text, works offline.

---

## Engineering principles

Before implementing any new feature, ask two questions:

1. **Does this expand the surface area?** Every new route, module, or abstraction is something a developer must understand. If the feature can be expressed through an existing system — the bus query protocol, the manifest pattern, the info.json content model — use it. Adding a new mechanism should require a convincing reason why the existing ones genuinely cannot serve.

2. **Is there an existing architectural system that can absorb this?** The bus event/query pattern, the worldBus service registry, the manifest loader, the SWR cache — these were built to be general. A new data source is a new agent with a `*_query` handler, not a new REST endpoint. A new scenario is a new manifest, not new server code. Reach for the existing system first.

The failure mode to avoid: feature explosion where each addition creates a new concept the user must learn, a new file pattern, a new interface. This happened with per-resource REST routes (`/api/events`, `/api/cities`) added alongside the bus — they bypassed the existing query architecture and created redundant surface. When caught, they were removed and collapsed back into the bus protocol.

---

## Design principles

- **No decorative lines.** Prefer space over borders to separate content. Avoid single narrow lines — they read as noisy and busy. 1px borders only where structurally necessary.
- **Minimal rounding.** 4px max. This is data, not a consumer app.
- **Generous whitespace** by default. Dense displays are acceptable but not the starting point.
- **Sparse color.** Accent only on interactive or semantically meaningful elements.
- **No web fonts.** System stack. Fast and offline-capable.
- **No persistent header or footer.** Floating controls only.

---

## UI patterns

- Top-right: small circular button opens a minimal menu (auth, settings). Shows user avatar when signed in.
- Modals for auth and confirmations. No page navigations for short flows.
- Home page background: rotating 3D Earth (Three.js), half-visible, circular crop, right-edge clipped. City dot markers in shades of blue. Evokes scale without decoration.
- Cards: slight transparent background so globe shows through gaps between them. No divider lines between cards.

---

## Logo / mark

A minimal circle with a thin orbital ring — SVG TBD. For now the wordmark "ORBITAL" in monospace caps suffices. Small and unobtrusive; this is not a brand-first product.

---

## Stack

- **Frontend**: Svelte 5 (runes mode), Tailwind CSS v4, Vite 6
- **Backend**: Fastify, Node.js, Socket.io
- **Simulation kernel**: `packages/bus` (pub/sub), `packages/spatial`, `packages/world`, `packages/elevation`
- **Auth**: Web3Auth v9 no-modal, Google OAuth, redirect flow, `CommonPrivateKeyProvider` with `CHAIN_NAMESPACES.OTHER`
- **3D globe**: Three.js — `website/client/src/lib/Globe.svelte`

---

## Repo layout

- `public/` — scenario assets, served at `/` by Fastify
- `website/client/` — Svelte SPA, builds to `dist/`
- `website/server/` — Fastify (serves dist + public + API + TLS)
- `packages/` — simulation engine packages
- `wiki/` — theory essays and implementation notes (not served)
- `CLAUDE.md` — this file; single source of truth
