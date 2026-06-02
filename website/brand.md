# Orbital — Brand

## Name
**Orbital** — the simulation workspace. Implies planetary scale, system dynamics, things in motion around other things.

## Tagline
*Simulation as argument.* Secondary: *Run the numbers. Share the results.*

## Voice
Sober, precise, direct. Peer-reviewed paper, not startup marketing. No exclamation marks. Numbers and outcomes over adjectives. The work speaks.

## Colors

| Token | Dark mode | Light mode | Use |
|---|---|---|---|
| `--bg` | `#07070e` | `#f4f4f8` | Page background |
| `--surface` | `#0f0f1c` | `#ffffff` | Cards, panels |
| `--border` | `#1e1e30` | `#e0e0ea` | Dividers |
| `--accent` | `#0fd4bc` | `#0aaa96` | Primary action, highlights |
| `--text` | `#dcdce8` | `#0f0f1c` | Body text |
| `--muted` | `#5a5a7a` | `#8080a0` | Secondary text, labels |

Accent is a teal that reads as "scientific instrument" — oceanographic charts, satellite data dashboards, climate visualization tools. Not cyan-aggressive, not green-environmental.

## Typography
- UI / prose: `ui-sans-serif, system-ui, sans-serif`
- Data / code / labels: `ui-monospace, monospace`
- No web fonts. System stack only. Fast, no flash of unstyled text, works offline.

## Geometry
- Rounded corners: minimal (4px). This is data, not a consumer app.
- Spacing: generous whitespace. Dense information displays are ok but not by default.
- Borders: 1px, subtle. Prefer space over lines to separate content.

## Logo / Mark
A minimal circle with a thin orbital ring — the SVG is TBD. For now, the wordmark "ORBITAL" in monospace caps suffices. Small and unobtrusive; this is not a brand-first product.

## UI Patterns
- No persistent header or footer. Floating controls only.
- Top-right: small circular button, opens a minimal menu (auth, settings). The circle can show a user avatar when logged in.
- Modals for auth and confirmations. No page navigations for short flows.
- Half-globe on home page: Earth satellite image, circular crop, right-edge clipped, low opacity background element. Evokes scale without decoration.
