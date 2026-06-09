20260609 - Hormuz Scenario Notes
----------------------------------------

The event injection question
This is the most architecturally interesting question. Currently we have:

A Hormuz simulation that runs with a BLOCKADE parameter (0-1)
A GDELT/ACLED event database with real conflict events
No connection between the two
The user is asking: can we use real events from the database to drive the simulation? The conceptual architecture would map specific event types to simulation parameters — for instance, an Iranian seizure event would increase blockade intensity, while a US Navy escort operation would decrease it. GDELT events could similarly trigger shifts in sentiment or economic pressure.

This is essentially scenario scripting, like what you see in complex models such as the Columbia River Basin or World3 — introducing policy levers and shock events into the system. To implement this, I'd need an event interpreter that translates real-world events into parameter changes, a timeline with ordered events and timestamps, and agents that can receive external shocks. The manifest could include a timeline of events with their types, values, and descriptions.

I'm considering three approaches: embedding events directly in the manifest as a predetermined trajectory (similar to IPCC SSP scenarios), querying real event databases like GDELT or ACLED and using AI to map them to simulation parameters, or loading separate scenario scripts that fire events at specific simulation ticks. The manifest approach is most tractable for now since Hormuz events can be sourced from actual data rather than hand-specified.

Now I'm thinking about tipping points — how to model the moment when a society's fabric tears, which is genuinely difficult to capture in simulation terms.

I'm looking at the empirical research on what actually triggers instability: food price spikes have a strong correlation with political unrest (the Arab Spring is the clearest example, with wheat prices preceding uprisings almost exactly), unemployment increases civil conflict probability, and the combination of income inequality with economic shocks is particularly destabilizing. I'm considering a threshold-based approach where a country agent has a stability index that degrades as food and fuel prices rise.

For the visualization, the key is showing the user the full cascade chain — how a blockade intensity flows through oil supply, energy prices, fertilizer production, crop yields, food insecurity, and finally political stability. This needs to be a dynamic flow diagram that updates as the simulation runs, showing the causal chain rather than just a single output number.

I also want to include a world map with a choropleth layer highlighting which countries face the most acute food security stress, time series graphs tracking the critical variables like oil and fertilizer prices alongside the food insecurity index, and that dramatic helium boiloff countdown as a visual anchor.

For connecting real-world events to the simulation, I'm thinking of an event classifier that maps ACLED or GDELT events into parameter shocks — either through rule-based logic (detecting keywords like "oil" or "Iran" to trigger blockade increases) or eventually machine learning. The scenario manifest would contain a timeline of events, each firing shock updates to the agent network at specific simulation ticks.

The really compelling part would be querying actual 2026 Gulf region events from the database, classifying them into simulation shocks, and running the model against what actually happened — giving us both a "what if" mode and a grounded "what actually occurred" baseline to compare against.

The core architectural pattern here is that the event manifest timeline and the GDELT-to-simulation mapping are really two modes of the same mechanism: external shocks flowing through the bus to update agent parameters. The food-security agent already has WFP thresholds built in, so level 3-4 becomes the natural tipping point signal, and the FSI score acts as a multiplier on how quickly stress cascades into instability. I don't need to model the political dynamics in detail — just flag when those thresholds are crossed.

For the web interface, I'm building an interactive dashboard for the Hormuz scenario with a blockade intensity slider as the main control, then displaying the cascading price effects across oil, LNG, urea, and food prices, a world map showing country stress levels, and a countdown timer for the helium shortage. The run and stop controls will hook directly into the existing simulation API.

Several interlocking questions here. Let me work through each.

The event injection problem
This is the most architecturally important gap. Right now the model has one lever — BLOCKADE — set at startup. What we need is a timeline of shocks that fire at specific ticks. The bus already supports this naturally.

The pattern is: external events become { shock: {...} } bus messages that agents handle:


// flows.js adds:
if (event.shock?.type === 'blockade_change')
  this.blockade = event.shock.value;
if (event.shock?.type === 'route_closure')
  this._routeCapacity[event.shock.route] *= event.shock.factor;
if (event.shock?.type === 'facility_shutdown')
  this._facilityOutput[event.shock.id] = event.shock.factor;
The manifest then carries a timeline agent that fires shocks at specified ticks:


export const timeline = {
  events: [
    { week: 0,  type: 'blockade_change',    value: 0.0,   note: 'Strait open — baseline' },
    { week: 4,  type: 'blockade_change',    value: 0.5,   note: 'Iranian mines deployed' },
    { week: 8,  type: 'blockade_change',    value: 0.85,  note: 'Full IRGC interdiction' },
    { week: 10, type: 'facility_shutdown',  id: 'ras_laffan', factor: 0.17, note: 'Missile strike' },
    { week: 16, type: 'route_closure',      route: 'suez_canal', factor: 0.3 },
  ],
};
This decouples what happens from how agents respond. The timeline is just data — you can hand-edit it, generate it from GDELT, or expose it as user controls.

The GDELT connection is then a query that translates real events into this format. Gulf ACLED events since January 2026 → classify by type and actor → map to shocks. This gives you a "what actually happened" mode. The classification can be rule-based initially (if actor1 == "IRGC" and event_type contains "attack" → blockade += 0.1), and it works well enough for the main patterns.

Tipping points
The "fabric tearing" problem is genuinely hard, but there are empirical anchors worth encoding rather than leaving it abstract.

The food price signal is the most reliable. Researchers studying the Arab Spring found that the FAO Food Price Index crossing ~210 correlates with civil unrest with about 6–12 month lag. This is not a model — it's an observed threshold. The food-security agent already computes a country-level price index; adding a threshold marker is a few lines.

Country fragility as a multiplier. The FSI (Fragile States Index) gives each country a baseline fragility score. A 30% food price rise in Japan (FSI ~20) is survivable; the same rise in Yemen (FSI ~110) crosses a tipping point immediately. The formula: instability_risk = fsf_score * price_shock_factor. This is mechanistically simple but empirically grounded.

The nonlinearity. Real tipping points are not linear — countries absorb stress up to a threshold and then collapse rapidly. The right model is a threshold function rather than a proportional one: below some stress level nothing changes politically; above it the probability of significant instability rises sharply. The World3 model handles this with S-shaped response curves. We can use a simple sigmoid: risk = 1 / (1 + exp(-k*(stress - threshold))).

For now the output is a signal, not a detailed political model: "Bangladesh has crossed the food security crisis threshold and its fragility score suggests significant instability risk within 3–6 months." That's useful and honest without overclaiming.

What to visualize
The Hormuz scenario web page needs to show the cascade as a cascade — not just a number, but the chain. The most effective layout:

Input controls — blockade intensity slider (0–100%), timeline selector (scripted crisis / what-if / GDELT-driven). This is the user's participatory interface.

Cascade panel — a column of connected indicators, each showing current value and trend arrow:


Blockade: 80% ──→ Oil flow: 25% ──→ Brent: $241/bbl ──→
LNG: $68/MMBtu ──→ Fertilizer plants: 10% ──→ Urea: +92% ──→
N-application: 72% ──→ Wheat yield: 85% ──→ 458M at risk
The arrows make causality visible rather than leaving it implicit.

World map — choropleth by country stress score (the food-security agent already computes this per country). Bangladesh/Pakistan red, Western Europe grey. This is the one image a reader carries away.

Helium clock — a countdown showing days until container boiloff destroys Qatar's supply permanently. This is the most dramatic non-obvious element and deserves its own visible indicator.

Time series — oil price and food insecurity index over the simulation run. Lets users see the trajectory, not just the endpoint.

On the CLI vs web question
The CLI already works — BLOCKADE=0.8 node packages/bus/run.js ... produces the cascade in the terminal. The console output is already the cascade in text form. That's the right baseline.

The web page adds: user controls (the slider), the cascade layout, the map, and the helium clock. It uses the same sim API the IPCC page uses — POST /api/sim, socket for ticks, and the bus query protocol for country data. The IPCC page is the template.

Sequencing
The most tractable immediate step is the timeline agent — a small bus agent that reads the events array and fires shocks at the right ticks. That connects real events to the simulation without requiring the full GDELT→classification pipeline. Once agents handle { shock: ... } events, you can hand-edit scenarios, expose sliders in the UI, and eventually drive them from the event database.

After that: the web page. It's the same pattern as the IPCC page — index.html in public/orbital/hormuz/, connects to socket, renders the cascade as the sim runs.

Want me to start with the timeline agent and the shock handlers, then the web page? Or would you rather write up the scenario design more fully in notes first?


******************

anselm thoughts:

ok, a general blockade parameter is too simple. we want to model systems from parts, better to model that a refinery has gone offline, or that 

1) blockades. Ok, I'm thinking a bit about a blockade parameter. Clearly digital twins are analogues of reality; they just have to be good enough, not perfect. Real oil flow impacts in the Hormuz this last year are a function of refineries going offline (for a variety of reasons such as being targeted by Iranian missiles or simply missing their own inputs such as electricity or raw crude or petroleum inputs), and then separately primarily, insurance risks around passage through the strait. A few tankers have taken the risk, a few have been damaged, a few have made it through - there seems to be a build up of tankers largely due to risk aversity and insurance skyrocketing; passage has been somewhat unclear - different nationalities and flags have also been affected in different ways. A single "blockade" parameter does over-simplify this - but arguably it depends on the fidelity of the model. The downstream impacts are in fact our primary interest; so simpler modeling here is debatable. I'm unsure here; I do want fidelity - and I want to "get real" on a model - not have it just be a toy. It's debatable.

2. Events. Thinking a bit more about shock events - yes - I think this is the right approach. We need to script scenarios a bit more in some way - we need probably multiple formalisms, ie; hard-coded scripted events, and also being able to consume and use events from the events database/catalog that we now have built up (which has over 5000 events in it I noticed). As you pointed out using these events does require some interpretation. Separately (lower priority) I can even see an argument for random events such as tsunami, hurricanes and so on - as a way to exercise systems. Re-running a system overall could have different events each time. You suggest a variety of approaches yourself "directly embedding events into the manifest" and also "querying real events" (we do already show some of these in our public/orbital/world-events scenario). You leaned towards just hardcoding for now - I'm mixed on that - we're not being very aggressive yet about our capabilities - and the larger goal is larger real world utility for a wider variety of scenarios - but it does get us past this point for now for sure for this one demo.

3. Cascade Chains. I do feel we do have cascade chains. Showing these is interesting. I actually had not thought about trying to directly visualize chains of relationships. That a blockade impacts oil supply, impacts energy prices, impacts fertilizer prices (and even fertilizer itself is blocked by the blockade), and affects crop yields, and affects food insecurity, and political stability. I'm wondering now if it makes sense to try actually show that explicitly. Our agents are somewhat 'implicit'; we don't expressely indicate that an agent is dependent on another agent? 

3. Tipping points. This is good - the simulation has an implicit or latent space for values changing - but humans sense and feel real tipping point catastrophes. Bridging between these two spaces is critical.



