# Topics to Model - 20260531

Goal is to identify topics to model. Some criteria:

- Specific: a real place, a real issue, real stakes, real outcomes, competing stakeholders.
- What is best first?
- What is easiest?
- What has real audiences?
- What is topical / in the news? When new stories break can we provide real insight?
- What is intersectional and slightly complex for humans to reason about?
- What has possibly unexpected side-effects?
- What is being discussed in media using only rhetoric and lacks rigor?

Also I want to try clump into sections - right now it is local, regional and planetary.

## Local: Urban and City Planning ( Stakeholders include cities, planners, citizens )

Can we help cities communicate with citizens; didactically and as a predictive or anticipatory democracy modeling tool - fostering citizen participation in useful ways. *Note that detailed bioregional modeling is in some ways harder than macroeconomic simulations.* So I worry about spending a lot of effort here for smaller audiences.

*Land use* - a family of general issues here that show up in the local news every day. Simulating some of these may be useful.

- New suburb approval: infrastructure cost, VMT increase, fiscal ROI to city. Environmental cost.
- Urban growth boundary change: habitat loss, housing cost pressure, service extension cost.
- ADU (accessory dwelling unit) legalization: density gain, neighborhood character, water/sewer load.
- Stormwater cost-benefit: impervious surface fees vs. detention basin construction.

*Green infrastructure* - often hard to prove diffuse benefits or counter-factuals; models can have real benefit here especially.

- Bioswale network: stormwater peak-flow reduction, pollutant capture, cost vs. gray pipe.
- Urban tree planting: heat mitigation, air quality, carbon sequestration, root damage to pipes.
- Green roof mandate: runoff delay, energy savings, structural load.
- Permeable pavement: groundwater recharge, flood reduction, maintenance cost.
- Urban heat island: tree canopy vs. pavement ratio, cool-roof mandates, temperature reduction.
- Air quality modeling: traffic, industry, prevailing wind, health burden by zip code.

*Streets* - I'm not a big fan of car street congestion modeling although will have to tackle it - hard to compete with existing efforts. There will need to be ways to score bottom line outcomes; costs, diffuse benefits to quality of life.

- Bicycle lane addition: modal shift, parking loss, injury rates, retail impact.
- EV charger placement: coverage gaps, grid load, equity across neighborhoods.
- Road closure or lane reduction: rerouting, delay, induced demand.
- Removing a street entirely: what fills the space, pedestrian / ecological benefit.
- Bus route change: ridership, coverage, transfer burden on low-income riders.
- School zone redistricting: travel distance, demographic exposure, crowding.
- Boring traffic sims, for example what if traffic lights were perfectly smart?

*Resilience* - probably fun and valuable
- Power grid failure cascade: N-1 contingency, blackout spread, restoration sequence.
- Water system failure after earthquake: pipe break distribution, pressure loss, hospital risk.
- Bridge closure on a corridor: freight rerouting, commute burden, economic cost per day.
- Hospital capacity under epidemic surge: bed availability, diversion, mortality impact.

*Speculative* - I very much want to play with radical what-if solutions for cities
- Flying car towers: elevate vehicles vertically, glide to destination; does it free street space?
  (I have a fun piece of design fiction around a tenerife 1977 futures conference that explores this)
- Autonomous vehicle fleets replacing private cars: parking land reclaimed, VMT change.
- Post-car neighborhood: parking converted to housing/parks, walking/cycling modal share.
- 15-minute city: walkability score under different zoning... test tax incentives to localize services

## Regional: Ecology and Environment ( Life, wildlife, beyond human, concerned citizens, NGOS, Universities )

*Biodiversity* - I often see articles on far-away places that may not be totally relevant to a persons life but are an interesting angle on an environmental issue. There may be some value in modeling some of these but it is not 100% clear if that will be as valuable to users as other models.
- African spurred tortoise fostering desert vegetation recovery.
  https://indiandefencereview.com/african-spurred-tortoise-sahel-desert-vegetation-recovery/

- Rewilding corridors such as in Banff: species movement, habitat fragmentation, land cost.

*Land*
- Soil carbon sequestration under different agricultural regimes such as in the american midwest.
- Farming mono-cultures

*Water* - Water specifically has many very interesting examples to study - will need hydrology models. Some of these are historical, some of these may be more current. Regression testing against historical data may be useful.
- Cadillac Desert: groundwater extraction, aquifer depletion, agricultural collapse.
- River dam removal: sediment flush, salmon recovery timeline, downstream flood risk.
- Dead zones: agricultural runoff, hypoxia, fish kill propagation in coastal shelf.
- Freshwater lens on small islands (Tuvalu): sea-level intrusion, population viability.
- Chesapeake Bay nutrient cycle: farm runoff, oyster filtration, SAV recovery.

*Fire*
- Wildfire spread up canyon terrain: slope/aspect, fuel load, wind channeling - such as LA County.
- Post-fire debris flow risk: burn scar, rainfall intensity, downstream exposure.

*Deforestation*
- Amazon tipping point: deforestation fraction that triggers regional rainfall collapse.
- Deforestation cascade: hydrology, albedo, regional rainfall feedback.

*Coral Reefs*
- generally many topics here

## Planetary: Macro, Supply Chain, Planetary anxieties

Very interested in modeling these; I see a lot of speculation here. It also makes good press. There are many hyperbolic and breathless articles here.

*Macroeconomics*

- https://www.ipcc.ch/assessment-report/ar6/
- Strait of Hormuz closure: oil price shock, LNG rerouting, country-level GDP impact.
- Suez / Panama blockage: container rerouting cost, delivery delay, inflation pulse.
- Semiconductor supply chain disruption: fab concentration risk, stockpile depletion.
- Agricultural export ban (wheat, rice): food price cascade, import-dependent country stress.
- Rare earth export restriction: EV battery cost, wind turbine supply, geopolitical leverage.
- Port strike: just-in-time inventory depletion, sector-by-sector impact timeline.

*Megatrends*

- Ocean dead zone expansion over 20 years as temperatures and fertilizer runoff rise.
- Coral bleaching threshold: SST anomaly, recovery window, tourism and fishery impact.
- Permafrost thaw: methane release feedback, infrastructure damage, subsidence.
- Sea level rise inundation: which cities, which timelines, adaptation cost vs. retreat.

# Interesting articles

- https://www.reddit.com/r/nottheonion/comments/1tqs6nn/researchers_let_ai_models_run_a_simulated_society/

- simulate this:
- https://katu.com/news/local/people-for-the-elimination-of-animal-cruelty-exemption-controversial-petition-aims-criminalize-ban-hunting-fishing-pest-control-oregon

- just a ton of articles on hormuz oil:
    - https://x.com/Mark4XX/status/2060859047050399774
    - https://x.com/shanaka86/status/2061254566843466226
    - https://x.com/EdwardTWinz/status/2061126249389449260
    - https://x.com/shanaka86/status/2033713550972358849 <- helium
    - https://shanakaanslemperera.substack.com

- https://www.theatlantic.com/magazine/2025/12/trump-climate-change-acceleration/684632/

- https://news.agu.org/press-release/middle-east-north-africa-warming/ 
- https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2024JD041625


https://www.indiatoday.in/science/story/india-heatwave-deaths-study-extreme-heat-public-health-emergency-climate-change-2920200-2026-06-01

this isn't so much as model as simply a dataset - it is kind of neat
i wonder if it makes sense to have stuff like this?
New eDNA initiative aims to make freshwater quality monitoring more accessible by combining traditional macro-invertebrate surveys with cutting-edge eDNA sequencing to build a future Taxonomic Independent Community Index (TICI) in Denmark
https://x.com/evohologen/status/2061387420554113297
