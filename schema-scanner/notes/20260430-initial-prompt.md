April 30th 2026

Initial prompts and thoughts for a system that can ingest raw text, extract objects, and then extract shared prototypical components of those objects:

My goal today is to take a set of real world objects and use them as a basis to find platonic schema. one slight difference from a classical schema discovery is that i want to use an ecs pattern - the ecs pattern is to decompose objects into a series of more elemental components, but overall the goal is still to find a way to represent typical objects we see in the real world... 

basically i want to take a shot at extracting ECS style schemas from random real world content. given some set of real world artifacts i want to find formal schema that can capture them. so i am going to be feeding a system real world data and expanding schemas that represent objects using that data.

codewise: i imagine this is going to be a standalone nodejs project with its own package.json and some npm based tools i can run to be able to trigger various steps, i tend to use es6 imports and i tend to not use typescript for these kinds of projects, i tend towards smaller reusable services in a library of some kind - i prefer DRY. i recommend putting this work in the folder schema-test

codewise: generally i see a system that has a series of steps in a sequence of capabilities - possibly exposed as individual npm tools i can run from the console?:

tools:

1) we need some "fuel", a source of real world objects. one source can be just claudes imagination. since claude has a latent collection from its source material. but i think i want claude to generate small stories about topical world events, so that we exercise an idea of object extraction. i don't want claude to just generate some objects, rather we will do that as a separate phase. we don't want to just use claude here directly - rather we have a .env file that has a claude key - we want to use claude via that .env file. ie we want a repeatable npm command that can generate some fuel - optionally on a given topic.

2) we then need to do content analysis and conversion to entities. given a news article, a twitter post, or something else (such as claudes imagination above), i want an llm driven harness that plucks out the subjects in that unstructured content; this can be the people, places, things, events, natural resources and other artifacts. it _may_ also make sense to enumerate the relationships as well.... these get stored as objects in association with that data source... there can be duplicates - we will de-dupe separately... deduping is a low priority for now actually.

3) now, finally, the main effort is to take this 'fuel' and to decompose these entities into ecs components. it's not totally clear to me how we will do this; i think we will try to find things that are similar to each other, and then, perhaps knowing the components we already have, we will try to decompose those things into the existing components, and may have to extend those components or invent new components. this is the real discovery phase - basically we're trying to classify artifacts in the world, decomposing them into somewhat formal platonic ideals.

to understand the subtleties here more clearly:

see my github for 'social appliance' which has a public/shared/schema-components for an example of a (hand-built) collection of entity components that are used to compose representations of really fundamental objects - i've taking very fundamental ideas (places, events and so on) and made decisions about where a single component can capture the essence of that aspect of a richer object. note that i am not happy with the subfolder pattern of schema-components/meta - but if we just store schema components in their own table that is fine. a schema component is simply a definition of a given component. i do a little trick where i define these within the same overall json notation as ordinary object instances.

also see notes/20260430-initial-thoughts.md (in this repo) for a larger conversation with claude where we explored component based schemas for objects as a whole ... among other topics.

4) (later) we need some kind of de-duper; we will have many similar objects from many sources - we need a concept of a canonical object that references the variety of separate objects that are referencing that entity. i am unsure how such a comparer would be efficient; maybe it is a vector space search? this implies then that raw source objects are distinct from canonical objects - perhaps there are multiple tables, one for raw ingestion, with provenance, and one for canonicalized best effort objects - where hmm, the raw ingest objects can be updated to refer to the canonicalized instance they are speaking about?
