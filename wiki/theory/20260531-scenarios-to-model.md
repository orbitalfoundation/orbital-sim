# Scenarios worth modeling

The scenarios below are organized at three scales — local, regional, planetary — but before listing them it's worth asking what we're optimizing for when choosing what to build, and what physical building blocks we have to work with.

---

## Criteria for a good scenario

Not every interesting question makes a good simulation. The ones worth building tend to share most of these properties:

- **Specific.** A real place, a real issue, real stakes, competing stakeholders — not a generic case study.
- **Intersectional.** The interesting behavior arises from coupled dynamics that resist simple rhetoric. If a spreadsheet and a press release are adequate, a simulation adds nothing.
- **Diffuse benefits or deferred costs.** These are exactly the cases where colloquial political reasoning fails systematically and a model can show something a room full of people cannot easily see. (See the asymmetries in the participation essay.)
- **Topical.** Can we provide structured insight when a story breaks — Hormuz, a wildfire, a heatwave — rather than only in planning cycles?
- **Counterfactual.** The model's job is often to make visible the thing that didn't happen: the flood that was averted, the housing that wasn't built, the aquifer that won't be there in thirty years. These are structurally invisible to rhetoric-based politics.
- **Accessible audience.** A model of Tuvalu's freshwater lens has a smaller natural audience than a model of a bike lane on a street people live on. Both are worth building, but priorities matter.

---

## Physical primitives: what the earth gives us

Before the scenario list, it's useful to know what can be computed from geometry and physics alone — without expensive databases or numerical weather prediction. These are the building blocks that make simple models possible quickly.

**Insolation and irradiance** — mostly analytic. Given latitude, longitude, elevation, slope, aspect, and time, direct and diffuse solar irradiance can be computed without storing much. The expensive part is cloud shadowing, which requires a volumetric atmospheric layer. Without clouds: a global irradiance map for any moment is a rendering problem, computable on demand. This means: light reaching a point at any time of day or year, shadow from terrain, and basic solar energy potential at a location are all tractable without data downloads.

**Slope and flow direction** — naturally cellular. Given a digital elevation model (DEM), slope and aspect are local derivatives. Flow direction per cell (D8 or D-infinity algorithms) gives you where water goes. Accumulated downstream flow gives you where streams form. Depression-filling (Wang & Liu's Priority-Flood algorithm) is the standard preprocessing step to handle DEM artifacts. This works well on a quadtree if cross-resolution flow edges are handled carefully. The result: a hydrology skeleton for any landscape from elevation data alone.

**Derived terrain products** — from the same DEM: slope steepness (fire and debris flow risk), topographic wetness index (where water pools), viewshed (what can be seen from a point), sky view factor (how much sky a point sees, relevant to heat and radiation).

**Temperature and ice** — speculative but tractable. A first-order global temperature field can be derived from latitude, elevation, land/ocean fraction, and season without a climate model. This is enough to estimate: where snow persists, which parts of the world are above wet-bulb thresholds, rough ice extent. Not accurate enough for policy, but sufficient for illustrative planetary scenarios.

**Weather: a spectrum of depth.** There is a wide range of approaches and a real decision about how deep to go:
- *Statistical/lookup*: store climatological means and variance, sample from distributions. Cheap, no physics, no dynamics.
- *Shallow water equations*: 2D fluid on the surface; captures large-scale pressure patterns surprisingly well for the compute cost.
- *Primitive equations*: what real numerical weather prediction (NWP) models use. This is what to avoid reinventing.
- *Cellular automata weather*: underexplored but viable for simulation purposes — local rules approximating advection, convection, and precipitation. Not physically rigorous but behaviorally plausible.

The practical implication: simple scenarios can use analytic insolation, DEM-derived hydrology, and statistical weather. Complex scenarios (wildfire spread with real wind, flood routing with rainfall) need the richer layers — but even there, the analytic building blocks provide the skeleton.

---

## Local: urban and city planning

*Stakeholders: cities, planners, citizens, developers, neighborhood groups.*

This is the scale where the participation asymmetries are sharpest and the audience is most immediate. Detailed bioregional modeling at this scale is in some ways harder than macroeconomic simulation — the spatial resolution requirements are higher and the data more fragmented — but the audience is local and motivated.

### Land use
- **New suburb approval** — infrastructure cost per unit, VMT increase, fiscal ROI to city over 20 years, habitat conversion. Demonstrates the full-cycle cost that subdivision approval meetings rarely quantify.
- **Urban growth boundary change** — habitat loss at the edge, housing cost pressure at the core, service extension cost. The coupling between these is exactly what makes the politics contentious.
- **ADU (accessory dwelling unit) legalization** — density gain, neighborhood character change, water and sewer load. A good test case for the absent-stakeholder problem: the people who would rent the units aren't in the room.
- **Stormwater cost-benefit** — impervious surface fees versus detention basin construction versus distributed bioswales. Classic diffuse-benefit problem.

### Green infrastructure
- **Bioswale network** — stormwater peak-flow reduction, pollutant capture, cost versus gray pipe.
- **Urban tree planting** — heat mitigation, air quality, carbon sequestration, root damage to pipes. Multiple coupled benefits that are each individually weak but collectively strong.
- **Urban heat island** — tree canopy versus pavement ratio, cool-roof mandates, quantified temperature reduction. Directly buildable from the terrain primitives above plus land cover data.
- **Green roof mandate** — runoff delay, energy savings, structural load.
- **Air quality** — traffic and industrial sources, prevailing wind, health burden by zip code. Good candidate for an intersectional diffuse-cost model.

### Streets
- **Bicycle lane addition** — modal shift, parking loss, injury rates, retail impact. The canonical example of the distributional engagement asymmetry: twelve angry parkers versus three thousand cyclists.
- **EV charger placement** — coverage gaps, grid load, equity across income levels.
- **Road closure or lane reduction** — rerouting, delay, induced demand (the phenomenon where traffic fills any available space, making road-widening counterproductive).
- **Removing a street entirely** — what fills the space, pedestrian and ecological benefit.
- **Bus route change** — ridership, coverage, transfer burden on low-income riders.
- **School zone redistricting** — travel distance, demographic exposure, crowding.

### Resilience
- **Power grid failure cascade** — N-1 contingency, blackout spread, restoration sequence.
- **Water system failure after earthquake** — pipe break distribution, pressure loss, hospital risk.
- **Hospital capacity under epidemic surge** — bed availability, diversion, mortality impact.

### Speculative
- **Post-car neighborhood** — parking converted to housing and parks, walking and cycling modal share. What does the same land do differently?
- **15-minute city** — walkability score under different zoning regimes; tax incentives to localize services.
- **Autonomous vehicle fleets replacing private cars** — parking land reclaimed, VMT change.
- **Flying car towers** (design fiction) — elevate vehicles vertically, glide to destination; does it free street space? (There's an existing design fiction piece around a Tenerife 1977 futures conference that explores this.)

---

## Regional: ecology and environment

*Stakeholders: environmental NGOs, universities, wildlife agencies, concerned citizens, governments.*

This scale is harder to make immediately relevant to a general audience, but arguably more important. The bioregional dynamics here are slower and the counterfactuals less intuitive than urban examples — which is precisely where simulation earns its keep.

### Water
Water has the richest set of tractable scenarios, and the DEM-derived hydrology primitives above apply directly here.

- **Cadillac Desert** — groundwater extraction, aquifer depletion, agricultural collapse. Historical: can regression-test against observed drawdown.
- **River dam removal** — sediment flush, salmon recovery timeline, downstream flood risk change.
- **Dead zones** — agricultural runoff, hypoxia, fish kill propagation in coastal shelf. Chesapeake Bay and Gulf of Mexico are the canonical cases.
- **Freshwater lens on small islands (Tuvalu)** — sea-level intrusion, population viability. The entire island's freshwater sits in a thin lens above saltwater; sea-level rise compresses it from below while storms overwash it from above.
- **Chesapeake Bay nutrient cycle** — farm runoff, oyster filtration, submerged aquatic vegetation recovery.

### Fire
- **Wildfire spread up canyon terrain** — slope, aspect, fuel load, wind channeling. Directly computable from terrain primitives and fuel data. LA County is a current and topical case.
- **Post-fire debris flow risk** — burn scar hydrophobicity, rainfall intensity, downstream community exposure.

### Biodiversity and land
- **Rewilding corridors (Banff)** — species movement, habitat fragmentation, land acquisition cost.
- **Amazon tipping point** — deforestation fraction that triggers regional rainfall collapse through the forest-moisture feedback loop. One of the most important nonlinear thresholds in the Earth system.
- **Deforestation cascade** — hydrology change, albedo shift, regional rainfall feedback.
- **Soil carbon sequestration** — different agricultural regimes in the American Midwest; policy leverage on a large diffuse sink.
- **African spurred tortoise fostering desert vegetation recovery (Sahel)** — a smaller-scale example of a nonlinear ecosystem interaction where a single introduced species changes the trajectory.

### Coral
- **Bleaching threshold** — sea surface temperature anomaly, recovery window, tourism and fishery impact. SST data is freely available; the bleaching response curve is well-characterized.

---

## Planetary: macro, supply chain, systemic risk

*Stakeholders: investors, policymakers, journalists, analysts, anxious citizens.*

The planetary scale is where media coverage is most breathless and least rigorous, which makes it a high-value target. A model that puts numbers on a Hormuz closure or a permafrost feedback adds something to a news cycle dominated by assertion.

### Supply chain and geopolitical shocks
- **Strait of Hormuz closure** — oil price shock, LNG rerouting, country-level GDP impact. Timely: there are currently many speculative articles about this with no quantitative grounding.
- **Suez / Panama blockage** — container rerouting cost, delivery delay, inflation pulse.
- **Semiconductor supply chain disruption** — fab concentration risk (Taiwan), stockpile depletion timelines.
- **Agricultural export ban (wheat, rice)** — food price cascade, import-dependent country stress.
- **Rare earth export restriction** — EV battery cost, wind turbine supply, geopolitical leverage.
- **Port strike** — just-in-time inventory depletion, sector-by-sector impact timeline.
- **Helium supply disruption** — a surprisingly brittle single-source supply chain with broad industrial and medical dependencies.

### Megatrends and tipping points
- **Sea level rise inundation** — which cities, which timelines, adaptation cost versus retreat. Well-characterized physically; the scenario value is in making it spatially specific and stakeholder-legible.
- **Permafrost thaw** — methane release feedback, infrastructure damage (northern Russia, Canada, Alaska), subsidence.
- **MENA warming** — surface temperature rise in the Middle East and North Africa; desert regions warm at amplified rates because no soil moisture buffers CO₂ forcing. Parts of the Gulf may cross wet-bulb survival thresholds within decades.
- **India heatwave mortality** — extreme heat as a public health emergency; scaling from observed events to projected frequency under different emissions pathways.
- **Ocean dead zone expansion** — temperature and fertilizer runoff over 20-year timescales; hypoxia spreading from river mouths.

---

## A note on eDNA and observational datasets

Some of the most interesting recent work in environmental monitoring is less about simulation and more about measurement — eDNA (environmental DNA) sequencing to assess freshwater ecosystem health, combining traditional macroinvertebrate surveys with molecular methods. This is not a simulation problem but a data infrastructure problem: making biological monitoring cheaper and more accessible so that more of the water column gets watched more often. Worth knowing about as a potential data input to regional models, and as a model for what "civic science" at the observational layer looks like.

---

## What to build first

The scenarios above vary enormously in complexity and data requirements. A rough ordering by buildability:

1. **Insolation and terrain** — analytic, no data download required beyond a DEM. Can produce a global irradiance map, shadow map, and slope/flow skeleton immediately.
2. **Urban heat island** — terrain + land cover (NLCD or OSM) + the analytic insolation layer. A tractable first local scenario.
3. **Wildfire spread** — terrain + fuel data (LANDFIRE in the US) + statistical wind. A compelling visual output with life-safety stakes.
4. **Freshwater lens (Tuvalu)** — small domain, well-characterized physics, existing literature to validate against.
5. **Hormuz closure** — I-O matrix shock with EXIOBASE as the data foundation; no spatial component needed for a first version.

The simple question is always: what are we computing, and do we have the data to compute it? The analytic building blocks — irradiance, slope, flow direction — let us build the first few without waiting for data pipelines.
