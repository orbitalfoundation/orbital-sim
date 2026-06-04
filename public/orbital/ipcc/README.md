# IPCC AR6 Climate Scenarios — a participatory model

Most people encounter IPCC findings through a news article. A headline announces that the planet is on track for 2.7°C by 2100, a graphic shows colored temperature bands, and the reader absorbs a fact. The fact is correct. But the relationship between the reader and the evidence is passive — they are told, they do not explore.

This scenario is an attempt at a different relationship. The model here is not opaque infrastructure running in a supercomputer center that only specialists can interrogate. It is roughly 200 lines of arithmetic that you can read, modify, and run yourself. The output is a geographic heatmap of temperature change. The inputs — which CO₂ pathway to follow, what year to examine, what equation to use for the atmosphere — are all explicit and changeable. This is simulation as argument rather than simulation as authority. The distinction matters: an argument can be examined, disputed, refined, and built on. An authority can only be accepted or rejected.

---

## Background: the IPCC and AR6

The **Intergovernmental Panel on Climate Change** (IPCC) was established in 1988 by the WMO and UNEP to synthesize the scientific literature on climate change for policymakers. It does not conduct original research. Instead, its working groups review and synthesize the state of published science across three domains: the physical science basis (Working Group I), impacts and adaptation (WG II), and mitigation (WG III). The **Sixth Assessment Report (AR6)**, published 2021–2023, is the most recent synthesis.

AR6 WG I is the physical science report. Its Chapter 4 covers future climate projections; Chapter 7 covers the energy budget and feedbacks; Chapter 11 covers extremes; the Atlas at the end provides regional projections. The chapter structure matters because the model here is a highly simplified version of the chain from Chapter 7's energy balance to Chapter 11's geographic pattern, and reading alongside the source material makes the simplifications legible.

### Shared Socioeconomic Pathways

The scenarios in this model are the **SSPs — Shared Socioeconomic Pathways**. They were developed by a large consortium of modelers as replacements for the earlier RCP (Representative Concentration Pathway) scenarios. Four are implemented here:

- **SSP1-2.6** — aggressive mitigation. CO₂ peaks around 430 ppm in the 2040s and then falls. Represents a world that takes the Paris Agreement seriously and deploys negative emissions. Total forcing by 2100 ≈ 2.6 W/m².

- **SSP2-4.5** — intermediate. Often described as "current policies with some improvement." CO₂ rises to ~600 ppm by 2100, then stabilizes. The default in this model. Forcing ≈ 4.5 W/m².

- **SSP3-7.0** — high emissions with fragmentation. Regional rivalries, slow energy transition. CO₂ reaches ~867 ppm. Forcing ≈ 7 W/m².

- **SSP5-8.5** — very high, fossil-fuel-intensive development. CO₂ exceeds 1100 ppm by 2100. The upper bound scenario; often treated as a stress test. Forcing ≈ 8.5 W/m². (This scenario has been recently criticized and to some degree discounted).

A critical point: the SSPs are not predictions. They are conditional scenarios — what happens *if* the world follows a given emissions trajectory. The question is not which one will happen but which one choices determine. Presenting them as a menu rather than a single forecast is itself a participatory gesture: these are branches on a decision tree, not items in a forecast.

CO₂ trajectories for each SSP come from the **RCMIP (Radiative Forcing Model Intercomparison Project)** database and AR6 WG1 Table 7.SM.6. The values in `atmosphere.js` are interpolated from decadal breakpoints in that data.

---

## The physics: energy balance

The model uses a **zero-dimensional energy balance model (EBM)** — the simplest physically meaningful representation of the global climate. Understanding it requires no more than high-school physics.

The Earth receives energy from the Sun and radiates energy back to space. In equilibrium, these balance. The rate of incoming absorbed solar radiation is:

```
F_in = S₀/4 × (1 − α) ≈ 238 W/m²
```

where S₀ = 1361 W/m² is the solar constant, divided by 4 to account for the spherical geometry, and (1 − α) reflects that the planetary albedo α ≈ 0.30 absorbs 70% of incoming light.

The rate of outgoing longwave (thermal infrared) radiation is:

```
F_out = ε σ T⁴
```

Kirchhoff's law in the form of the Stefan-Boltzmann relation, with T the surface temperature, σ = 5.67 × 10⁻⁸ W/m²/K⁴, and ε the effective emissivity of the Earth-atmosphere system (~0.61). This effective emissivity is what greenhouse gases reduce: CO₂ absorbs outgoing infrared, re-emitting some downward, effectively lowering ε and trapping heat.

The additional forcing from CO₂ is given by the **Myhre 1998 formula**, the standard used across virtually all climate modeling:

```
F_CO₂ = 5.35 × ln(C / C₀)   [W/m²]
```

where C is the current CO₂ concentration in ppm and C₀ = 280 ppm is the pre-industrial baseline. This logarithmic relationship — not linear — is why "doubling CO₂" is the standard unit: it always adds the same forcing (~3.7 W/m²) regardless of the starting concentration.

With a forcing perturbation, the temperature evolves as:

```
C_heat × dΔT/dt = F_CO₂ − λ × ΔT
```

where ΔT is the anomaly from pre-industrial equilibrium, C_heat = 3 × 10⁸ J/m²/K is the effective heat capacity of the climate system (roughly a 100m ocean mixed layer), and λ = 1.24 W/m²/K is the **climate feedback parameter**.

λ is the single most important number in climate science, and it encodes a great deal of complexity. It represents the sum of all feedback processes: water vapor (positive), lapse rate (negative), ice-albedo (positive), clouds (uncertain but net positive). The value 1.24 W/m²/K corresponds to an **Equilibrium Climate Sensitivity (ECS) of 3°C per CO₂ doubling** — the AR6 best estimate:

```
ECS = F_2×CO₂ / λ = 3.71 / 1.24 ≈ 3°C
```

The model is initialized by running this equation forward from 1850 (pre-industrial) to the simulation start year using the historical CO₂ record, so the 2024 state reflects approximately the current level of committed warming.

### ECS versus TCR

Two numbers appear frequently in climate discussions and are often confused.

**ECS (Equilibrium Climate Sensitivity)** is the long-run temperature change after the climate fully equilibrates to a CO₂ doubling — usually thousands of years, because the deep ocean takes that long to warm. AR6 best estimate: 3°C (range 2.5–4°C).

**TCR (Transient Climate Response)** is the warming at the moment CO₂ doubles, in a scenario where CO₂ increases at 1% per year — typically 70 years. It is smaller than ECS because the ocean hasn't had time to fully respond. AR6 best estimate: 1.8°C (range 1.4–2.2°C).

This EBM captures transient behavior because it has a finite heat capacity (C_heat) that causes lag. The characteristic time constant is τ = C_heat / λ ≈ 7.7 years: roughly how quickly the surface responds to a forcing change. Over a century-long simulation, the model shows both the lag (early ticks warm slowly) and the accumulation (warming accelerates as forcing increases).

---

## Geographic warming: pattern scaling

The EBM gives a single global mean temperature anomaly. But the geographic distribution of warming is what matters for any specific place — and it is radically non-uniform.

**Pattern scaling** is the technique used here, and across much of the IPCC attribution literature, for distributing a global mean anomaly geographically without running a full General Circulation Model. The method: multiply the global mean ΔT by a location-specific **amplification factor** derived from GCM ensembles. The factors come from **AR6 WG1 Chapter 11** (regional climate change) and the Atlas.

The major patterns:

**Arctic amplification.** The Arctic warms roughly 3× faster than the global mean. This is the largest and most robustly modeled pattern in climate science. The mechanisms are interacting: sea ice loss reduces albedo (ice-albedo feedback); warming air increases water vapor (which is a stronger greenhouse gas at high latitudes); changes in atmospheric circulation patterns amplify surface heating. The Antarctic warms less (factor ~1.7) because the Southern Ocean's large heat capacity buffers the signal on century timescales.

**Land–ocean contrast.** Land warms roughly 1.5× faster than ocean globally, because ocean has far greater heat capacity (it can absorb and store more heat per degree of temperature change), and because evaporation over ocean provides a latent heat cooling mechanism absent over dry land. The contrast shows up clearly in the PNG output.

**Mediterranean and Middle East amplification.** AR6 Chapter 11 documents that the Mediterranean basin and MENA region warm substantially faster than the global land average — roughly 20% above the mid-latitude land factor. The mechanism involves drying (reduced soil moisture reduces evaporative cooling) and altered atmospheric circulation patterns. This is one of the clearest regional signals in the CMIP6 ensemble.

**Tropical ocean suppression.** The tropical ocean warms slower than the global mean (factor ~0.65), partly because of the thermohaline circulation drawing up cooler deep water, and partly because the Hadley cell structure modulates how much of the radiative forcing reaches the surface.

The amplification factors are encoded in `warmingPattern()` in `atmosphere.js`. They are derived from the AR6 reported values, not from a first-principles physical derivation. This is an honest simplification: pattern scaling is what the IPCC itself uses for many impact assessments, and the errors are well-characterized.

The current implementation uses latitude bands only. The next step is adding longitude-dependent variation — the Mediterranean hotspot, the West African monsoon region, the South Asian heat island — which would require either a tabulated 2D pattern array or fitting functions to the CMIP6 ensemble output.

---

## What was built

The scenario is implemented using Orbital's agent-based bus architecture. Three agents compose the simulation:

**`elevation`** (`packages/agents/elevation.js`) loads the GEBCO 2026 5 arc-minute bathymetric raster — a 4320 × 2160 Int16 array encoding elevation in metres. Negative values are ocean. This is used to determine land/sea status at any point for both pattern scaling and visualization.

**`atmosphere`** (`packages/agents/atmosphere.js`) implements the EBM. On initialization it silently spins up from 1850 to the starting year (2024 by default), accumulating the historical warming from the pre-industrial baseline. On each tick it:

1. Reads the CO₂ concentration for the current year by interpolating the SSP trajectory table
2. Computes the radiative forcing: `F = 5.35 × ln(CO₂ / 280)`
3. Advances the temperature with a forward Euler step: `ΔT += (dt / C) × (F − λ × ΔT)`
4. Prints the year, CO₂, and global mean anomaly to stdout

It also builds a 360 × 180 amplification grid on the first tick (once elevation is confirmed loaded), by sampling the GEBCO data at 1° intervals to determine land/sea status at each cell. The installed `bus.atmosphere` service then supports queries at any (lon, lat):

```javascript
bus.atmosphere.co2_ppm()                     // current CO₂ concentration
bus.atmosphere.global_delta_t()              // global mean ΔT from pre-industrial
bus.atmosphere.temperature_anomaly(lon, lat) // local ΔT using AR6 pattern scaling
bus.atmosphere.year()                        // current simulation year
```

**`snapshot`** (`packages/agents/snapshot.js`) renders the temperature field as a 1440 × 720 equirectangular PNG at specified intervals (every 10 ticks / years by default, plus a final frame). For each pixel it queries `bus.atmosphere.temperature_anomaly()` and `bus.elevation.sample()`, then applies a color scale and an ocean-darkening correction. Output lands in `public/orbital/ipcc/output/`.

The color scale runs from ivory at 0°C through amber and orange to deep maroon above 6°C — the standard warm-end diverging scale for temperature anomaly maps. Ocean pixels are darkened and blue-shifted relative to land (blended ~45% with a dark navy) so continents are legible without a separate coastline dataset.

### The manifest pattern

The manifest `public/orbital/ipcc/manifest.js` is a minimal ES module that declares which agents to load and with what parameters:

```javascript
export const atmosphere = {
  inherits: '@orbital/agents/atmosphere.js',
  scenario: 'SSP2-4.5',
  t0: 2024,
};
```

The bus loader reads this, imports the default export from `atmosphere.js`, merges the manifest fields on top, and registers the result. The model is parameterized entirely through the manifest and environment variables — no code changes are required to run a different scenario.

---

## Running it

**Prerequisites**: Node.js 20+, the GEBCO 5 arc-minute raster at `public/.data/elevation/global_5arcmin.i16`.

```bash
# SSP2-4.5 (intermediate scenario), 2024–2100
node packages/bus/run.js public/orbital/ipcc/manifest.js \
  --ticks 76 --dt 31536000 --t0 2024-01-01T00:00:00Z

# High-emissions scenario
SCENARIO=SSP5-8.5 node packages/bus/run.js public/orbital/ipcc/manifest.js \
  --ticks 76 --dt 31536000 --t0 2024-01-01T00:00:00Z

# Mitigation scenario
SCENARIO=SSP1-2.6 node packages/bus/run.js public/orbital/ipcc/manifest.js \
  --ticks 76 --dt 31536000 --t0 2024-01-01T00:00:00Z
```

Each run takes a few seconds and produces 7–8 PNG frames in `public/orbital/ipcc/output/`. The stdout output shows year, CO₂, and global mean anomaly at each tick — sufficient to sanity-check the model before looking at the maps.

Expected results at 2099:

| Scenario | CO₂ (ppm) | Global ΔT | Arctic ΔT (≈) |
|---|---|---|---|
| SSP1-2.6 | ~368 | +1.5°C | +4.8°C |
| SSP2-4.5 | ~601 | +3.2°C | +10.2°C |
| SSP3-7.0 | ~867 | +4.8°C | +15.4°C |
| SSP5-8.5 | ~1135 | +6.0°C | +19.2°C |

These are in-range with IPCC AR6 projections (SPM Table SPM.1), which give likely ranges of 1.0–1.8°C, 2.1–3.5°C, 2.8–4.6°C, and 3.3–5.7°C respectively for the same scenarios. Our EBM is at the mid-to-high end for SSP2-4.5 and SSP3-7.0 — consistent with an ECS of 3°C and a heat capacity calibrated to the transient response, but without the negative aerosol forcing that counteracts some greenhouse warming in the near term.

---

## Reading the output

The PNG heatmaps show temperature anomaly relative to the pre-industrial (1850) baseline, not relative to 2024. The 2024 starting frame already shows ~1.6°C of warming — the committed warming from the historical record. Each subsequent frame shows the additional warming under the selected SSP pathway.

The visual immediately communicates several things that numbers alone don't:

**The geography of risk is not where most infrastructure is.** The darkest pixels are the sparsely populated Arctic and the high plateaus. The most densely populated parts of the tropics — South and Southeast Asia, sub-Saharan Africa — sit in the middle of the orange range: not the worst locally, but where population exposure is highest. The most economically significant amplification in the near term is the Mediterranean and MENA band, where summer heat stress and water scarcity compound.

**The difference between scenarios is visible, not just numerical.** Running SSP1-2.6 and SSP5-8.5 back to back produces maps with clearly different color distributions. The 2099 final frames are not subtly different — they are different hue zones. This is what 1.5°C versus 4.5°C of additional local warming looks like.

**The land/sea distinction matters for policy.** Ocean warms more slowly, but ocean warming drives sea level (thermal expansion) and storm intensification. The darkened ocean pixels are a reminder that slower surface warming conceals stored heat that will drive consequences over longer timescales than this model spans.

---

## Limitations

This is a transparent simplification. What it leaves out:

**Aerosol forcing.** Sulfate aerosols from fossil fuel combustion and volcanic eruptions exert a negative forcing (cooling) that partially offsets greenhouse warming. This model includes no aerosols, which is why it runs slightly warm compared to the IPCC central estimates. Adding aerosol forcing would require a matching trajectory in the SSP database and a separate forcing term in the EBM.

**Feedbacks beyond the linear λ.** The single feedback parameter λ = 1.24 W/m²/K linearizes all feedbacks around the current climate state. At very high temperatures, some feedbacks — particularly Arctic permafrost carbon release and ice-sheet dynamics — become nonlinear and potentially threshold-crossing. These are absent.

**Precipitation and moisture.** Temperature anomaly is one dimension of climate impact. Precipitation changes — the shifting monsoon, increased drought frequency, intensified storms — are arguably more consequential for human systems than temperature alone. These require a coupled hydrological model.

**Spatial pattern limitation.** The geographic pattern currently varies only with latitude and a single regional adjustment for the Mediterranean. The full CMIP6 ensemble pattern has longitudinal variation — the Indian Ocean warming faster than the Pacific, the West African monsoon band behaving differently from the East African — that would require either a 2D lookup table or fitting to the CMIP6 multi-model mean.

**Ocean heat content and sea level.** The model tracks surface temperature only. Sea level rise requires tracking ocean heat content (thermal expansion) and ice sheet mass balance (dynamic contribution). Both are extensions the architecture supports but this version doesn't implement.

---

## What comes next

The architecture is designed for layering. The next step is **place-based agents** — entities with fixed geographic positions that query `bus.atmosphere.temperature_anomaly(my_lon, my_lat)` at each tick and compute local consequences: heat stress days above 35°C wet-bulb, growing degree day changes, water stress indices. A city agent placed at Lagos, Jakarta, or Phoenix can translate the global field into something specific: how many additional days per year above dangerous heat threshold under each scenario.

Beyond that: coupling the atmosphere to a demographic model (WorldPop gridded population data, ~100m resolution) makes it possible to compute exposure — not just temperature anomaly at a point but the number of people experiencing it. This is the gap between the physical model and the policy argument: a 4°C Arctic is a scientific result; 800 million additional person-days of extreme heat per year in South Asia is a political claim.

The data sources for this coupling exist and are open: WorldPop for gridded population, SEDAC for vulnerability indices, FAOSTAT for agricultural exposure. The model will eventually incorporate them.

---

## The participatory argument

The IPCC assessment process is one of the most rigorous collective scientific endeavors ever organized. It has also produced a communication failure of the first order: most people on the planet are substantially affected by its findings and substantially unable to engage with them. The reports are long, technical, and mediated — read by specialists, summarized by journalists, argued about by politicians, and received by citizens as a stream of escalating warnings that produce anxiety without agency.

The problem is not that the science is too complex. The energy balance model above is not complex — it is arithmetic, and the arithmetic has been taught in introductory physics for a century. The problem is that the model has never been placed in front of people in a form they can actually run.

When you can run a scenario, several things change. The SSPs stop being a taxonomy of futures someone else decided and become a menu of choices that depend on decisions being made now. The geographic pattern stops being a news graphic and becomes a map you can query at a specific place. The uncertainty range — visible when you compare SSP1-2.6 to SSP5-8.5 — stops being a disclaimer and becomes a quantified account of what policy choices are worth.

This is not a replacement for GCMs. It is not peer-reviewed climate research. It is an instrument for a different kind of engagement — what might be called **participatory computational argument**: making the models that structure public policy decisions accessible not just to specialists who can audit them but to anyone who can run a command.

The tradition this sits in is long. Stafford Beer's Project Cybersyn attempted something similar for a national economy in 1971 — putting real-time feedback in the hands of workers, not only planners. The difference is fifty years of cheap computation, open data, and a publishing platform with no gatekeepers. The barrier is no longer computational. It is cultural: we have not yet built the expectation that citizens should be able to run the models that govern them.

This scenario is one step toward that expectation.

---

## References

**AR6 WG1 Chapter 4** — future global climate. The scenarios this model replicates in simplified form.
https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-4/

**AR6 WG1 Chapter 7** — the energy budget, radiative forcing, and climate sensitivity. Source for the λ = 1.24 W/m²/K value and ECS best estimate.
https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-7/

**AR6 WG1 Chapter 11 / Atlas** — regional projections and warming patterns. Source for the amplification factors.
https://www.ipcc.ch/report/ar6/wg1/chapter/chapter-11/

**Myhre et al. (1998)** — New estimates of radiative forcing due to well mixed greenhouse gases. *Geophysical Research Letters* 25(14). The source of the 5.35·ln(C/C₀) formula.

**Meinshausen et al. (2020)** — The shared socio-economic pathway (SSP) greenhouse gas concentrations and their extensions to 2500. *Geoscientific Model Development* 13(8). Source for the SSP CO₂ trajectories.
https://doi.org/10.5194/gmd-13-3571-2020

**RCMIP (Radiative Forcing Model Intercomparison Project)** — the dataset from which SSP concentration pathways are drawn.
https://rcmip-protocols.org/

**GEBCO Compilation Group (2026)** — General Bathymetric Chart of the Oceans, 2026 release. Land/sea mask and elevation data used in pattern scaling and visualization.
https://www.gebco.net/

**simulate.world** — the broader context for this work: a public talk on planetary-scale simulation as a form of argument.
https://www.youtube.com/watch?v=ibgt7Mbw2tE
