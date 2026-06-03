# The landscape of socio-environmental simulation

There is a large and well-funded world of simulation software — but most of it models factories, warehouses, hospitals, and logistics networks. The thing it optimizes for is throughput. A different and smaller tradition has always been interested in a harder problem: what happens to the world over time when humans and natural systems push on each other? This is the territory covered here.

The field goes by several names — systems modeling, integrated assessment, socio-environmental simulation, complexity economics — and the practitioners rarely all know each other. What they share is a concern with feedback, delay, and nonlinear collapse that industrial simulation mostly ignores.

---

## The lineage

The intellectual origin is **Jay Forrester** at MIT in the 1960s, who invented system dynamics: a way of representing the world as stocks (things that accumulate) and flows (rates of change) connected by feedback loops. Delays and nonlinearities in those loops are where all the interesting behavior lives — overshoot, collapse, oscillation.

Forrester's students **Donella and Dennis Meadows** applied this to the whole planet. Their 1972 report for the Club of Rome, *Limits to Growth*, used the **World3** model to simulate interactions between population, food production, industrialization, pollution, and resource depletion across twelve scenarios to 2100. It sold 12 million copies in 37 languages and remains the founding document of the field. The model has been updated and its predictions have held up better than its critics expected.

The **[Club of Rome](https://www.clubofrome.org)** — founded 1968 as a gathering of scientists, economists, and public figures concerned with long-range planetary futures — remains an institutional anchor, as does the **[Global Resource Observatory](https://www.anglia.ac.uk/research/groups/global-sustainability-institute)** at Anglia Ruskin, which continues to run World3-lineage models.

---

## Modeling paradigms

**System dynamics (SD)** is the Forrester/Meadows lineage. The world is stocks and flows; feedback loops drive behavior. Best for understanding delays, overshoot, and policy resistance at a macro level. Not well suited to individual actors or spatial heterogeneity.

**Agent-based modeling (ABM)** complements SD when you want discrete actors — households, firms, governments, species — making decisions under uncertainty. Emergent behavior arises from local interactions rather than being specified top-down. The academic backbone for complexity economics.

**Input-output (I-O) analysis** goes back to Wassily Leontief's 1940s work: an economy as a matrix where every sector's output is another's input. Shocking a row (a port closes, a crop fails) propagates mechanically through the matrix. Simple, transparent, and still the workhorse for tracing upstream/downstream impacts.

**Computable general equilibrium (CGE)** models extend I-O with price responses and market-clearing. More realistic economics, but heavier data requirements and less transparent dynamics. GTAP (Global Trade Analysis Project) is the dominant framework for trade policy analysis.

**Integrated assessment models (IAMs)** couple climate physics to economics — the modeling technology behind IPCC scenario analysis. DICE (Nordhaus), MESSAGE, and REMIND are the major examples. They tend to smooth over heterogeneity and spatial detail in exchange for tractability.

**Earth system models (ESMs)** are the full climate simulations run by NOAA, ECMWF, and similar institutions. High resolution, physically grounded, computationally expensive, and primarily concerned with physical variables rather than human dynamics.

---

## Tools

### System dynamics
- **[Vensim](https://vensim.com)** (Ventana Systems) — the industry standard; used in climate modeling, pandemic response, resource management. The World3 model runs in Vensim.
- **[Stella Architect](https://www.iseesystems.com/store/products/stella-architect.aspx)** (isee systems) — more accessible; widely used in education and policy work.
- **[PySD](https://pysd.readthedocs.io)** — runs Vensim and Stella models in Python; brings SD into the scientific-Python ecosystem.

### Agent-based
- **[NetLogo](https://ccl.northwestern.edu/netlogo/)** — the lingua franca of ABM research. Accessible, huge model library, limited scalability. Good for prototyping.
- **[Mesa](https://mesa.readthedocs.io)** (Python) — the Python-ecosystem equivalent. Mesa 3 (2025) substantially reworked agent management and visualization.
- **[Agents.jl](https://juliadynamics.github.io/Agents.jl)** (Julia) — performance-oriented; supports continuous space, graph-based environments, and OpenStreetMap data. The speed/expressiveness sweet spot for larger models.
- **[GAMA Platform](https://gama-platform.org)** — strongest choice when geography is central. Has its own spatial ABM language (GAML) and deep GIS integration; used in urban planning and epidemiology.
- **[Repast HPC](https://repast.github.io)** (Java/C++) — explicit scale-up path for simulations beyond a single machine; used in defense and large-scale social science.
- **[AnyLogic](https://www.anylogic.com)** (commercial) — uniquely combines system dynamics, ABM, and discrete-event simulation in one environment. The most-used commercial tool for multi-paradigm work; popular in supply chain and policy consulting.
- **[FLAME GPU 2](https://flamegpu.com)** — GPU-accelerated ABM for millions of agents.

### Economic modeling
- **[GTAP](https://www.gtap.agecon.purdue.edu)** (Global Trade Analysis Project) — multi-region CGE model and database; the standard in trade policy analysis.
- **[EXIOBASE](https://www.exiobase.eu)** — multi-region input-output database covering ~200 countries × ~200 sectors, with environmental extensions (CO₂, water, land use per sector). Exceptional for tracing ecological impact through supply chains.
- **[EMA Workbench](https://emaworkbench.readthedocs.io)** (Python) — exploratory modeling and analysis under deep uncertainty; scenario discovery and robust decision-making methods.

---

## Data sources

The hardest part of any model in this domain is data, not the engine. The key sources:

**Trade and economy**
- **[UN Comtrade](https://comtradeplus.un.org)** — the authoritative source for international merchandise trade flows by country and commodity, going back decades. Free tier available.
- **[Observatory of Economic Complexity (OEC)](https://oec.world)** — beautifully structured product-level trade data derived from Comtrade; better interface and API than the raw UN data. Built at MIT Media Lab, now independent.
- **[GTAP Data Base](https://www.gtap.agecon.purdue.edu/databases/default.aspx)** — the economic input-output database underlying the GTAP CGE model; covers global bilateral trade and production.
- **[EXIOBASE](https://www.exiobase.eu)** — multi-region I-O with environmental extensions; the right foundation if you want to trace CO₂, water, or land use through supply chains.

**Energy**
- **[IEA — International Energy Agency](https://www.iea.org/data-and-statistics)** — the authoritative source for energy production, consumption, and trade by country and fuel type. Some datasets are free; detailed data requires subscription.
- **[EIA — US Energy Information Administration](https://www.eia.gov/international/data/world)** — US government energy data; more accessible than IEA for many datasets; good global coverage.

**Food and agriculture**
- **[FAOSTAT](https://www.fao.org/faostat)** — UN Food and Agriculture Organization; covers production, trade, prices, land use, and emissions for agriculture and forestry globally. Free and well-documented.

**Minerals and materials**
- **[USGS Mineral Resources Data System](https://mrdata.usgs.gov)** — global mineral deposit and production data from the US Geological Survey. The standard starting point for critical minerals supply chain analysis.
- **[USGS Mineral Commodity Summaries](https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries)** — annual snapshots of production, reserves, and trade for ~90 commodities.

**Ocean and bathymetry**
- **[GEBCO — General Bathymetric Chart of the Oceans](https://www.gebco.net)** — the authoritative global seafloor topography dataset. Essential for anything involving ocean depth, submarine cables, shipping routes, or coastal dynamics. Free download.

**Marine and fisheries**
- **[Global Fishing Watch](https://globalfishingwatch.org/data-download/)** — vessel tracking data derived from AIS transponders; covers fishing vessel activity globally. Useful for modeling fisheries pressure, illegal fishing, and ocean governance. Open data.

**Geography and infrastructure**
- **[OpenStreetMap](https://www.openstreetmap.org)** — the open map of the world; ports, roads, pipelines, power lines, buildings, land use. The foundation for most spatial modeling work. Access via [Overpass API](https://overpass-api.de) or planet dumps.
- **[Natural Earth](https://www.naturalearthdata.com)** — free vector and raster map data at 1:10m, 1:50m, and 1:110m scales. The standard for cartographic boundaries, coastlines, and physical features.

**Climate and atmosphere**
- **[ERA5 / Copernicus Climate Data Store](https://cds.climate.copernicus.eu)** — ECMWF reanalysis data; hourly global climate variables going back to 1940. The foundation for most climate impact modeling.
- **[NASA Earthdata](https://earthdata.nasa.gov)** — land surface, vegetation, ocean color, ice, and atmosphere data from the NASA satellite fleet.

**Population and society**
- **[WorldPop](https://www.worldpop.org)** — gridded population estimates at 100m resolution; useful for spatial demographic modeling.
- **[SEDAC — NASA Socioeconomic Data and Applications Center](https://sedac.ciesin.columbia.edu)** — the bridge between social science and earth science data; gridded population, GDP, poverty, environmental health.

---

## Institutions and research groups

**[Santa Fe Institute](https://www.santafe.edu)** — the complexity science center of gravity. Founded on the premise that economic and ecological systems are complex adaptive systems, not equilibrium machines. Rob Axtell's large-scale ABM work and Eric Beinhocker's complexity economics originated here.

**[Oxford INET](https://inet.ox.ac.uk) / [Macrocosm](https://macrocosm.group)** — J. Doyne Farmer's group at the Institute for New Economic Thinking at Oxford built some of the most rigorous agent-based macroeconomic models, then spun out Macrocosm as a company billing itself as an agent-based "digital twin" unifying climate, macro, and geopolitical risk. The closest existing thing to a general-purpose coupled socio-environmental simulator.

**[PIK — Potsdam Institute for Climate Impact Research](https://www.pik-potsdam.de)** — runs several of the major IAMs and does coupled climate-economy scenario work for European policy.

**[Stockholm Resilience Centre](https://www.stockholmresilience.org)** — home of planetary boundaries research and socio-ecological systems (SES) framing; the intellectual origin of "safe operating space for humanity."

**[CASA — Centre for Advanced Spatial Analysis, UCL](https://www.ucl.ac.uk/bartlett/casa)** — Mike Batty's group, the lineage for urban digital twins and geo-coupled simulation. Relevant when geography and spatial interaction matter.

**[SESYNC — National Socio-Environmental Synthesis Center](https://www.sesync.org)** (University of Maryland) — dedicated to synthesis research at the interface of human and ecological systems.

**[CoMSES / OpenABM](https://www.comses.net)** — the open research community for computational and agent-based modeling. Peer-reviewed, DOI-assigned model repository. The highest-yield place to find existing models and practitioners.

**[IPCC](https://www.ipcc.ch)** — the Intergovernmental Panel on Climate Change; the main institutional consumer of IAMs and ESMs; its reports define the scenario vocabulary (SSP, RCP) that most climate-adjacent modeling uses.

---

## Notable people

**Jay Forrester** — inventor of system dynamics; MIT; foundational.

**Donella Meadows** — lead author of *Limits to Growth*; her posthumous *Thinking in Systems* remains the clearest introduction to the paradigm.

**[J. Doyne Farmer](https://doynefarmer.bsky.social)** — Macrocosm / Oxford INET / SFI; complexity economics and large-scale ABM. Active on Bluesky.

**[Kate Raworth](https://www.kateraworth.com)** — doughnut economics; the policy-facing bridge between planetary boundaries and local economic design. [@KateRaworth](https://twitter.com/KateRaworth) on X.

**Mike Batty** — urban simulation; CASA UCL; *The New Science of Cities*.

**[R. Maria del Rio-Chanona](https://twitter.com/RMaria_drc)** — complexity economics and computational social science at UCL; one of the more active researchers posting in this space.

**[Andrew Hudson-Smith](https://twitter.com/digitalurban)** — digital urban systems, CASA; [@digitalurban](https://twitter.com/digitalurban).

**Daniel Christian Wahl** — regenerative design and biomimicry; the bridge to bioregional practice. [@DrDCWahl](https://twitter.com/DrDCWahl); heavier on LinkedIn and Medium.

**Stephen Lansing** — modeled the Balinese water temple irrigation system as a coupled human-natural system; a landmark case study in emergent resource management.

**EO Wilson** — biodiversity science; his half-earth proposal is a planning problem that simulation can inform.

---

## Books

**Limits to Growth** — Meadows, Meadows, Randers, Behrens (1972, updated 2004). The founding document. Widely misrepresented; worth reading directly.

**Thinking in Systems** — Donella Meadows (2008, posthumous). The clearest introduction to system dynamics as a way of seeing. Essential.

**World Dynamics** — Jay Forrester (1971). The technical origin of the World3 work. Dense but foundational.

**The Fifth Discipline** — Peter Senge (1990). System dynamics applied to organizational learning; introduced the field to a management audience.

**Growing Artificial Societies** — Epstein and Axtell (1996). The founding text of agent-based social simulation. Showed that macro social patterns can emerge from micro behavioral rules.

**Complexity and the Art of Public Policy** — Colander and Kupers (2014). Complexity economics for policy practitioners; accessible.

**The New Science of Cities** — Mike Batty (2013). Urban systems as networks and flows; the spatial simulation perspective.

**Doughnut Economics** — Kate Raworth (2017). The planetary-boundaries / social-foundation framing that has become the policy lingua franca for this kind of work.

**A General Theory of Simulation** — Benjamin Bratton (Antikythera, ongoing). A philosophical account of simulation as a general condition, not a technical tool — asking what it means for models to precede and shape what they model. [Project site](https://theoryofsim.antikythera.org/). Harder to read than anything else on this list but raises questions the engineering literature ignores.

**Antifragile** — Nassim Taleb (2012). Not simulation per se, but the clearest articulation of why fragility and nonlinearity matter in complex systems.

**The Collapse of Complex Societies** — Joseph Tainter (1988). Historical analysis of why complexity has a cost and how it leads to collapse. Essential context for anyone modeling civilizational dynamics.

**Cadillac Desert** — Marc Reisner (1986). The definitive account of water politics in the American West; a case study in how resource systems and political systems co-evolve. The documentary is also excellent.

---

## The gap

The macro-modelers (Oxford, SFI, PIK) and the bioregionalists (Doughnut Economics, Salmon Nation, regenerative design) almost never overlap. The modelers have rigorous tools but tend toward global abstraction; the bioregionalists have place-based insight but rarely formalize it computationally. The intersection — mechanistic, place-specific simulation used as a form of argument or advocacy — is a relatively sparse niche.
