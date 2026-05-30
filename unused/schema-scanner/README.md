This is not used currently - we will revisit it later. May 25 2026

# schema-test

Experiments in **discovering platonic, ECS-style schemas from real-world content**, with the long-term goal of using the resulting graph to drive simulation behaviour.

The pipeline is a small chain of npm scripts. Each stage reads from and writes
to flat JSON files under `data/`, so any stage can be re-run independently.

```
seed ───┐
        ▼
fuel / import  ─►  extract  ─►  derive  ─►  ( prototype ─►  cluster )
   sources         entities      components    prototypes      …
```

Stages 1–3 are automated (they call Claude). Stages 4+ are still being shaped
by hand — see [Prototypes](#prototypes) below.

---

## Why this project exists

This is **automated knowledge-graph induction with an ECS twist**. It sits at
the intersection of three traditions, and borrows from all three without quite
belonging to any of them:

| Tradition | What we take from it | What we leave behind |
|---|---|---|
| **Schema.org / classical ontology** | Concrete vocabulary, well-understood concepts (Person, Place, Event) | Strict class hierarchies (`Thing → CreativeWork → Article → BlogPost`) |
| **Knowledge graphs / GraphRAG** | LLM extraction of entities + relations from unstructured text; provenance tracking | Flat triples with no factoring; treating nodes as opaque labelled blobs |
| **ECS in games (Unity DOTS, Bevy, Flecs)** | Composition over inheritance; orthogonal components; systems iterate over component sets | Hand-authored components — we want them *induced* from data |

The novel angle is using an LLM to **factor** real-world entities into reusable
components, rather than tagging them with class labels. Then, separately, we
use **prototypes** (in the sense of Rosch and Lakoff) to capture the
human-folk-classification view: a *typical* container ship, a *typical* dive
site. Prototypes are emergent groupings of components, not classes.

### Three layers, three jobs

1. **Components** are the atomic, orthogonal aspects of things — `location`,
   `condition`, `vessel`, `quantity`. They are the units of *re-use* and the
   handles for *behaviour* (a system that runs over everything with a
   `condition` component can model wear-and-tear regardless of what kind of
   thing wears).
2. **Prototypes** are bags of components + expected relations that describe
   *typical* members of a folk category — a "container ship" or a "dive site".
   They are the units of *recognition* and the handles for *summarisation*.
   An entity may match several prototypes to varying degrees — radial
   categories, not boxes.
3. **Entities** are the concrete observations from the world — the Meridian
   Grace, Ben's Blue Hole, Captain Voss. Each is composed of components and
   may be tagged with one or more prototypes.

### When relationships are first-class, and when they aren't

This is one of the most consequential design choices in any graph-shaped
system, so it gets a section to itself.

> **Reify a relationship as a `relation` entity when the link itself has time,
> strength, provenance, or any field of its own. Inline it as a property when
> it doesn't.**

Examples:

| Link | Treatment | Why |
|---|---|---|
| `vessel.length_m = 200` | property on `physical` | A length doesn't have a start date or a counter-party. |
| `region.country = "Bahamas"` | property on `region` | Structural; no temporal extent. |
| `Captain Voss → captains → Meridian Grace` | `relation` entity | Has a start date, may end, may be contested. |
| `Cascade Cold Storage → owns → refrigerated truck` | `relation` entity | Ownership has lifecycle, transfer history, provenance. |
| `frozen salmon → destined_for → Pacific Northwest Distributors` | `relation` entity | Has an "until delivered" lifetime. |
| `dive site → has → max_depth: 14` | property on `habitat` | Just a number. |

The cost of reifying everything is graph bloat and traversal pain. The cost of
inlining everything is losing the ability to talk *about* the relationship.
The split above keeps both costs manageable.

---

## Setup

```sh
cp .env.example .env       # add your ANTHROPIC_API_KEY
npm install
npm run seed               # copy hand-built seed components into data/components/
```

## Tools

### 1. Generate or import sources

A "source" is anything we want to feed the system: a generated story, an
imported JSON record, a pasted email.

```sh
npm run generate                                          # random topic
npm run generate -- --topic "small-town port" --count 3
npm run import   -- ./dive-sites.json --kind dive-site    # JSON object or array
npm run import   -- ./note.txt --kind note
```

The importer normalises records into the standard envelope and synthesises a
readable `text` view of each, while preserving the original payload under
`data` so the extractor can read structured fields with their types intact.

### 2. Extract entities

Pluck the people, places, things, events, organisations, resources, and
relationships from each source. Structured `data` is read directly so types,
arrays, and nested objects are preserved; prose is used as a supplementary
signal.

```sh
npm run extract                       # any sources missing entities
npm run extract -- --all
npm run extract -- --source <id>
```

### 3. Derive components

Take the accumulated entities, look at the components we already have
(`data/components/`), and decompose each entity into ECS components. Strongly
prefer reusing existing components. Extend them when a new field is clearly
part of an existing component's essence; invent only when no existing
component fits.

```sh
npm run derive                        # entities not yet decomposed
npm run derive -- --all
npm run derive -- --source <id>
npm run derive -- --batch 12
```

Seed components live in `public/shared/schema-components/` and are **never
mutated** — `npm run seed` copies them into `data/components/` where the
working set lives. Extensions and inventions accumulate `_addedBy` and
`_provenance[]` so divergence from the seed is auditable.

### Prototypes

Prototypes are currently **hand-authored** — see `data/prototypes/`. Each one
sketches a typical member of a folk category as a *bag of components* plus
*expected relations*:

```jsonc
// data/prototypes/container-ship.json (excerpt)
{
  "label": "Container ship",
  "components": ["meta", "vessel", "physical", "condition", "schedule",
                 "location", "cargo", "quantity"],
  "expected_relations": [
    { "predicate": "owns",        "object_kind": "party",   "note": "shipping company" },
    { "predicate": "captains",    "subject_kind": "party" },
    { "predicate": "carries",     "object_kind": "cargo" },
    { "predicate": "registered_in","object_kind": "region" }
  ],
  "neighbours": ["tanker", "bulk-carrier", "fishing-boat"]
}
```

The current set covers the entities in the sample sources: `container-ship`,
`fishing-boat`, `dive-site`, `harbor`, `warehouse`, `person`, `organisation`,
`organism`, `consignment`, `incident`, `refuel-event`, `place`. See
`data/prototypes/_index.json` for the catalogue.

A future `npm run prototype` (or `cluster`) tool would *induce* prototypes by
grouping decomposed entities with similar component-sets and attribute
distributions — but until we have enough data, hand-authored prototypes are
both faster and clearer.

### Inspect

```sh
npm run ls                            # sources / entities / components / prototypes
```

---

## Layout

```
bin/                         # CLI entry points
lib/                         # reusable services (claude, storage, prompts, log)
data/sources/                # raw fuel
data/entities/               # extracted entities + decompositions, keyed by source
data/components/             # ECS component definitions (seeds + derived)
data/prototypes/             # hand-authored radial-category sketches
```

## Honest assessment / open questions

- **The component set will keep drifting.** Even seed components are extended
  in place as new sources teach us new fields. That's by design; the seed
  library is the read-only baseline, `data/components/` is the working set.
- **Some "components" want to be entities.** `incident`, `refuel`, `harvest`
  are events that *happen between things*, not aspects of a thing. They are
  modelled here as `event` *entities* with `event.kind` set, plus relations
  to participants — see the `incident` and `refuel-event` prototypes for
  worked examples.
- **No simulation systems yet.** Components describe state; systems describe
  change. The next real test is to write one or two tick-based behaviours
  (e.g. a `Schedule` system that fires arrivals/departures, a `Condition`
  system that wears things down) and see whether the discovered components
  are actually shaped right to drive them. They probably aren't, quite.
- **Dedup / canonicalisation is deferred.** Two sources mentioning "Seattle"
  produce two entities today. A future stage will resolve them — likely via
  blocking + embedding similarity + LLM judge, the standard KG-resolution
  recipe.

## Related work worth knowing

- **Microsoft GraphRAG** (2024) — hierarchical summarisation over an LLM-induced KG with community detection.
- **LangChain `LLMGraphTransformer`**, **LlamaIndex `PropertyGraphIndex`** — same shape as our `extract` step.
- **Neo4j LLM Knowledge Graph Builder** — hosted version of the same workflow with explicit ontology hints.
- **NELL, Knowledge Vault, DeepDive** — the academic precursors before LLMs.
- **FrameNet (Charles Fillmore)** — frames are roughly prototypes with named slots; closest classical neighbour to what we're trying.
- **Flecs / Bevy ECS** — pure component composition for game runtimes; what we'd like our induced schema to look like.
- **Schema.org** — the de-facto vocabulary; we borrow concepts but reject the strict hierarchy.
