# Anselm Comments to Claude: Monday June 1st 2026 Thoughts around interface

Before we dig into the model I want to first stop and look at how the project communicates to users.

I think we're going to need a jupyter notebooks kind of interface. I don't know how jupyter works. But let's imagine what it might be like.

Let's think about how this could all be framed - feel free to push back:

1) As we know this system is fundamentally multiplayer, we have a public folder, with public/party for individual or organizations, these are namespaces on a first come first serve basis. And within that area a user can do whatever they wish, such as having /public/anselm/africa_middle_east_warming_2049 ... They can have their manifests, agents, any state, and even a web page - all client side content. Arguably there may be some server side content (gebco) but thats separate.

2) If we are able to serve ordinary web pages from these folders then those web pages can show whatever they want. These web documents are effectively the "paper" or "presentation" and they can have embedded rich computational widgets that are client side renders of server side compute. Clearly we can trivially have a fairly vanilla server that can serve http. This server could be in /packages/server - and it can serve both http and also have an api gateway that exposes deeper functionality. One specific capability this server side api would have is it would let us spin up an instance of an orbital.bus - basically a way to run a simulation on the server side. At some point we would want auth and perms, but I think for now it would be good enough to just let the client just start up a simulation at will, with some kind of uuid - probably for example say 'anselm/africa_middle_east_warming_2049' ... hmm, it might actually make sense that we do have a 1 to 1 mapping between the uuid and the real public path ... but anyway thats less of an issue.

3) Multiple third party callers can connect to a server using a web browser - so hmm, we will need some kind of session concept. I don't like cookies, I do like injecting headers into http traffic. For now those callers can be granted a session token of some kind. For that given view though, the server api would probably have to spin up a separate copy of the application? Maybe though the app has to specify if that is the case (somehow? some kind of configuration file in the public folder?) I can imagine multiplayer apps where there is only one instance of a server side instance. It's like a game server - some games are solo, every player runs their own copy of the back end, other games are shared.

4) We probably even want a sockets.io interface - we probably don't want to send http rest api gateway requests over and over - too slow to build and tear down connections.

5) Circling back to the client side web page - the page can be ordinary html, but can have blocks, possibly canvases or threejs surfaces, that show rich data - updated from the server. Implying some kind of client side api shim or helper.

6) Stylistically I tend to like tailwind and a system preferences driven light/dark mode. I also want this to feel sciency; so when we come to mocking out a client side interface that is what I am thinking. Also I imagine the very root of the entire site will have some kind of browser - similar to shadertoy.org . Also, hmm, I think it may make sense to have concepts like a chat window capability - perhaps also merged with a conversational interface to an AI. We may have to circle back to this later.

7) Later (don't write this now) separately from this "presentational view" there will be an editor interface. We don't need to write this now because we have shell access to the entire file system - so we are currently able to use power tools like visual studio to arrange files exactly as we wish.

Does this capture the kinds of capabilities that Jupyter notebooks provides? Is it using a server driven pattern with client side rendering? I want to be as flexible as possible so I want to support vanilla html on the client side. If I look at google.collab I see that they use markdown with two kinds of cells, text or code. I lean more towards ordinary HTML with inclusions that are small fragments of javascript leveraging a back end api - this is less "user friendly" but I'm thinking we are going to use an AI to drive these documents. I can imagine that the back end can provide a rich set of widgets for client side visualization (showing a simulation itself, showing statistics etc).

## Anselm Notes: Version 2


I think we need a beefier more traditional website pattern. Right now we have static pages such as /public/index.html but it is inexpressive and inflexible. Let's build something more conventional:

1) create a folder /website . this will hold the website with /website/client and /website/server - moving the server from /packages/server (packages will concentrate just on orbital core functionality instead). We'll need boilerplate to compile the site, and for the server to be able to serve the site.

2) /website/client will be svelte 5.5.6 at least - using npm install svelte@latest - https://svelte.dev/ - es6, tailwind, mobile focused, use system light dark mode

3) server will be fastify and will serve static content first - so if a user is visiting /username/projectname and that area has an index.html that will be used rather that the svelte blob .

4) we should use web3auth https://web3auth.io/ - it works well although slightly tricky to integrate with servers sometimes - also note i don't like cookies i prefer http headers with session state.

5) user experience for home page: the "/" or root will be a lander page, it will have a bit of splashy detail about the project, it is actually largely going to be static, although i do prefer modular componentized pages rather than single monolithic pages. it will showcase a few recent projects, this can be hand tweaked actually - we don't need to query a database for this, and generally have best practices around lander pages - although in our case we're pretty sober/serious and less promotional. you can probably sketch something out and i can revise if needed. again i am  tailwind, mobile focused, use system light dark mode.

Here is a fun non-critical idea: I'm kind of keen to try a "half globe" - basically many websites often have a globe on the home page - but I thought it would be fun if the globe was placed to the right size that the vertical axis shows only the left half of the globe. This can be done in 3d later like using threejs - however for now as a quick test we can just use a static image and place it half way to the right : https://en.wikipedia.org/wiki/Earth#/media/File:Meteosat-12-fci-march-equinox-2025-noon_(cropped).jpg 

We will want an authentication button somewhere. I tend to lean towards very minimalist unobtrusive layouts; so having a small circle on the top right corner that opens up to show a menu or login is a nice pattern - I don't like big headers - in fact I prefer small floating elements so that the user can really just have the whole experience of the main page without some silly header or footer. I've played with a variety of patterns here and these days I lean towards a single top right floating icon that can have the project name and somehow hints that it can be opened up for a small menu (authenticate or logout). I guess authentication can be a modal dialog. The back end server has to be able to grant a user a reserved namespace in the /public folder based on available paths. We probably can still at this point avoid having a back end mongo database since we can just look at the live filesystem (I'm trying to defer having a server with mongo state for now).

It may at this time make sense to set some brand styling - and this may need to be in a small document in this folder so that claude can reference it later. I don't have any brand thoughts - surprise me.

6) user experience for: /area . Every participant can reserve an area in /public based on first come first serve. This will enumerate the projects in that area (server has to look at the live filesystem since there is no server side db yet). Maybe we can detect if a user is authenticated for that area and provide admin controls to create /area/myprojectname ?

7) user experience for /area/projectname. Can serve a page here if there is no /area/projectname/index.html . Later we'll think about some kind of editing capability to edit files here - but can tackle that later.


---

## Claude Comments: Notes on approaches — Jupyter, Observable, and what we built

### Jupyter / Google Colab

Jupyter's model is a persistent server-side Python kernel connected to a browser client over WebSocket. The notebook is a JSON document (.ipynb) containing a sequence of cells — either markdown or code. Code cells execute in the kernel, and their output (text, matplotlib figures, ipywidgets) is rendered inline. State accumulates in the kernel across cell runs, so a later cell can reference variables from an earlier one.

Google Colab is Jupyter hosted by Google, with a managed kernel and Drive-backed storage. The cell model is identical.

The constraint: cells execute sequentially in a document, which fits exploratory data analysis well but is awkward for a live running simulation. You'd need to put the sim loop in a thread or use async cell magic. The output model is also oriented around snapshots, not streams.

### Observable and Deepnote

Observable (observablehq.com) is the closer analogy to what we're building. Notebooks are JavaScript-first. Cells are reactive — if cell B depends on cell A, it re-evaluates automatically when A changes. You can embed canvas, D3, Three.js, and other browser APIs directly in cells. The runtime is client-side; there is no persistent server kernel. Observable does have a fetch-based way to call external APIs, but the compute model is in the browser.

The difference from our approach: Observable is hosted and its "cells" are a proprietary reactive runtime. Documents are authored in a special JS dialect. An AI can generate Observable notebooks but the format has quirks.

Deepnote (deepnote.com) is a hosted Jupyter-compatible notebook aimed at data teams, with a polished collaborative UI and a strong built-in widget library — maps, charts, sliders, dataframe viewers. The widget pattern is worth remembering: a curated set of high-quality visualization components that drop into a cell with one line is a significant part of why those tools feel productive. We should build an equivalent widget library for `orbital-client.js` — a small set of ready-made components (heatmap canvas, time scrubber, cell table, scenario parameter panel) that a scenario page can include with a single tag. The bar for an AI-authored page drops considerably when it can say `<orbital-heatmap>` rather than write a canvas renderer from scratch.

### What we built and why

The approach here is closer to Observable in spirit but more web-native in execution. A scenario is an ordinary HTML file. It can include `/orbital-client.js` and `/socket.io/socket.io.js` to connect to a running simulation, but it can also be a static page with no server dependency at all. There is no special cell format or notebook runtime — the document is just HTML with script tags.

The server (`packages/server`) runs simulation instances (orbital bus + agents) and streams tick events to browsers over socket.io. The client helper (`orbital-client.js`) wraps the REST + WebSocket calls into a small API: `OrbitalClient.start(manifest, opts)` returns a `Session` that emits `tick` events.

Key decisions and rationale:

The server is a thin bridge, not a service. Real work lives in `@orbital/bus` and `@orbital/agents`. The server does not know about insolation, elevation, or any domain concept — it just starts buses and forwards events. This keeps the server small and means the same agents and manifests work from the CLI (`node packages/bus/run.js`) and from the web.

Plain HTML is the right document format here. An AI can write and edit it, it degrades gracefully when the server is offline, and it composes with any browser API. The tradeoff vs. Jupyter/Observable is that there is no built-in reactivity or cell runner — the author (human or AI) writes the wiring. For a tool where AI is doing a lot of the document authoring, this is acceptable.

The multiplayer/solo distinction maps onto socket.io rooms. Multiple browser tabs subscribing to the same sim ID share one running instance. A solo sim is just a shared sim with one subscriber. The manifest or calling code decides whether to create a new ID per session or share one.

The planned AI chat integration (not yet built) fits naturally: a chat interface modifies manifest parameters and calls a `session.patch(params)` method, which sends a socket message to the server to hot-reload and restart the sim. The document stays open; the sim restarts with new parameters.

### AI as the primary author

The deeper point is that the historical programmer "user interface" for building simulations is mostly going away. Almost nobody will write agent scripts or wire manifests by hand.

The two modes that matter are presentational — someone wants to show a city council or an investor what a scenario looks like — and conversational — someone is adding agents, adjusting parameters, asking "what if we double rainfall" and watching the model respond. In both cases the human is directing, not typing code.

This has real consequences for how the system should be designed. The file system layout, the manifest format, the agent API — all of it should be easy for an AI to read, write, and modify correctly on first attempt, with minimal implicit state and no magic. A flat directory of named JS files with explicit exports is better than a framework with conventions an AI has to infer. Plain HTML scenario pages are better than a proprietary notebook format. This is already the direction things have gone here, and it's worth making it explicit as a design principle: the system is structured for AI authorship, not human memorability.

The human role is curation, judgment, and presentation — deciding which scenarios matter, reviewing what the AI produced, and communicating results to an audience. The editing interface (VS Code or equivalent, plus a chat window) is the workbench. The scenario HTML page is the output.

The root gallery (like Shadertoy) remains to be built properly — currently a static index.html listing namespaces. Eventually it should show live thumbnails, metadata, and search across all public scenarios.

### The lineage: Neocities, Glitch, and what they got right

Neocities (neocities.org) is a deliberate revival of GeoCities — free static site hosting, upload HTML and you're live, no tooling required. It attracts artists, zine-makers, and people who want a personal page without a build pipeline. The aesthetic is often deliberately raw, but the underlying impulse is sound: the web should be writable by individuals, not just organizations with DevOps teams. Neocities has no compute, just files, but it keeps alive the idea that anyone can publish to the web and the barrier should be near zero.

Glitch (glitch.com) is worth noting as a spiritual predecessor to what we are building. It offered instant Node.js hosting with a browser-based editor — you forked a project, edited files live, and your app was running at a public URL within seconds. No build step, no deploy pipeline, no GitHub required. It was enormously popular for small experiments, creative coding, and quick demos precisely because the friction between "idea" and "running thing someone else can see" was near zero. It has since ended free hosting and the community has scattered.

The lesson is that deployment friction kills experimentation. The platforms that replaced it (Render, Vercel, Netlify, Railway) are more powerful but all require a git push, a build step, or at minimum a deploy button — enough friction to break the flow of a quick idea.

For this project, the equivalent of Glitch's frictionless deploy is running a local server and sharing it over a tunnel (ngrok, Cloudflare Tunnel, Tailscale funnel) — a URL is live in ten seconds. That covers the demo and collaboration use cases well enough for now. A hosted version of this server, where someone could push a manifest and get a live URL, would be a natural product direction later and would recapture exactly what made Glitch feel magical.

### Bret Victor and the idea of the web as a medium

Running through all of this is a thread that goes back to Bret Victor's work — particularly "Explorable Explanations" (2011) and the Dynamicland project. The central claim is that the web is not just a delivery mechanism for documents but a medium for thought: a place where models can be embedded in arguments, where readers can manipulate assumptions and see consequences, where the gap between claim and evidence is made interactive rather than left to the reader's imagination.

Computational notebooks (Jupyter, Observable, Deepnote), easy hosting (Neocities, Glitch), and now AI authorship are each partial steps toward that vision. The bottleneck has always been the cost of building the interactive part — it required programming, and programming required time and expertise most authors don't have. AI authorship removes that bottleneck. The author expresses an idea conversationally; the AI builds the running model and the page that presents it.

This project sits at that intersection. The scenarios are not just simulations — they are arguments with interactive evidence. The natural audience is anyone who needs to make a case about how a complex system behaves: a city planner, a journalist, a researcher, an activist. The presentation layer exists to serve that argument, not to demonstrate technical capability. That framing should guide every decision about what the interface looks like and how hard it is to author.
