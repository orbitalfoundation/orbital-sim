# Criticisms of building a new simulation platform

A document for thinking clearly about what is and isn't worth building. The criticisms here are genuine and should be taken seriously, not dismissed.

---

## The strongest objections

### 1. The agent runtime is already solved

Mesa, Agents.jl, GAMA, and Repast are mature, well-documented, community-maintained agent runtimes. They handle scheduling, spatial environments, data collection, and visualization. NetLogo alone has a model library with thousands of peer-reviewed models. Writing a new agent loop adds nothing to the field — it is, in the Farmer group's phrase, "undifferentiated work." The hard, open problems in multi-agent simulation are calibration and multi-scale coupling, not the mechanics of stepping agents forward in time.

**Weight:** High. This is the most legitimate objection if the goal is to advance simulation science. It weakens if the goal is something other than advancing simulation science.

### 2. Data is the constraint, not tooling

Having a beautiful model runner means nothing without data that is accurate, current, and at the right spatial and temporal granularity. EXIOBASE, GTAP, UN Comtrade, IEA, FAOSTAT — these took decades and tens of millions in funding to build. A new platform inherits none of that. The first version of any model built on a new platform will be demonstrably wrong, and the work to make it less wrong is data work, not platform work.

**Weight:** High for quantitative predictive models. Lower for qualitative or illustrative models where the point is to show a *structure* of causation, not a precise forecast.

### 3. Calibration is unsolved and you're not solving it

The genuinely open problem in this field is: how do you know your model is right? The Farmer group has spent years on this — surrogate/metamodel calibration, black-box Bayesian inference, differentiable ABMs (AgentTorch). A new platform that doesn't have a thesis about calibration will produce models that are, at best, illustrative and, at worst, misleading. Producing authoritative-looking outputs from uncalibrated models is arguably harmful.

**Weight:** High if the platform makes quantitative claims. Lower if the outputs are explicitly framed as scenarios or arguments rather than predictions.

### 4. The existing tools have thirty years of network effects

Vensim models are cited in IPCC reports. NetLogo models are peer-reviewed and archived in CoMSES. AnyLogic has a consulting ecosystem. The reason practitioners use these tools is not inertia — it is that working in a shared language makes your models reproducible, auditable, and comparable to prior work. A new platform is an island.

**Weight:** High for academic or policy work where auditability matters. Lower for public-facing or advocacy work where accessibility matters more than peer compatibility.

---

## Where the objections weaken

The objections above assume the goal is to build a better *computation engine* for use by simulation researchers. If that's the goal, the objections are largely correct.

They weaken considerably if the goal is something else:

### The publication layer doesn't exist

Every simulation tool listed in the landscape survey produces outputs that are locked inside a desktop application, a Jupyter notebook, or a PDF figure. There is no equivalent of Observable or Distill for simulation — no format for publishing a model as an interactive, explorable document that a non-specialist can run in a browser, inspect, and argue with. The closest things (NetLogo Web, some Stella online exports) are retrofits, not first-class publication targets.

If the thesis is "simulation as argument requires a new kind of document," that is a publishing problem, not a computation problem. The computation layer can be thin — wrapping existing runtimes, or running simple models directly — while the publication layer is the genuine contribution.

### Accessibility is a real gap

Running a Vensim model requires Vensim. Running a GAMA model requires GAMA and a working Java environment. Running a Mesa model requires Python. The audience that can do any of these things is tiny relative to the audience that has a stake in the questions being modeled. Interactive web-based publication, with no install friction, is a genuinely different thing from what exists — and the models don't have to be maximally rigorous to be useful to that audience.

### The coupling and scenario interface is unsolved

Even researchers who use mature runtimes struggle with: connecting models across domains (a climate model driving a crop model driving a migration model), running systematic scenario variations, and presenting the results in a way that makes the assumptions visible. These are interface and architecture problems, not computation problems. A platform with a strong opinion about how models connect and how scenarios are parameterized could be useful even if the underlying computation borrows from existing engines.

### Interoperability with existing models as a strategy

The objection that "you'll just reinvent Mesa" dissolves if the platform is designed to *run* Mesa, Vensim, and Julia models rather than replace them — as a layer that handles publication, visualization, scenario management, and data connection on top of whatever runtime the modeler chooses. This is closer to what Macrocosm is doing (wrapping calibrated components in a product layer) than to writing a new ABM from scratch.

---

## The honest synthesis

The criticism is correct if the claim is: "I am building a better agent-based model engine."

The criticism is wrong if the claim is: "I am building a way to publish simulation as an interactive argument, and I will use whatever computational substrate makes that possible — including existing runtimes, including simple models where simple is enough, including connecting to models others have already built."

The first framing competes with Mesa and loses. The second framing is genuinely unoccupied territory.

The practical implication: be willing to call a model "simple and illustrative" without apology, wrap existing tools where they're better, and treat calibration and data provenance as explicit variables in every published model rather than hiding them.

---

## Related questions worth keeping live

- When is an illustrative model useful and when is it misleading? What obligations come with publishing one?
- Is the right substrate a general runtime, or a set of domain-specific models (climate, hydrology, demography) that share a common interface layer?
- What would it mean to make the assumptions of a model as legible as the outputs?
