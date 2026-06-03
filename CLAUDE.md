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
