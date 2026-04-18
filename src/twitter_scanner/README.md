# Twitter Scanner Suite

This is now a small ES6 tool suite rather than a single monolithic scan command.

Collection and analysis are separated:

- ingest archive data
- ingest live recent data
- analyze dereferenced subjects and topic tags
- auth helper for user-context Twitter tokens
- status command
- small HTTP API service
- simulation sandbox with manifest-driven agent models

## Collections

- users
- twitter_posts
- twitter_interactions
- twitter_subjects
- twitter_scan_runs

Database default: scannerdata

Every document is linked to userKey, defaulting to anselm.

## Install

From this folder:

npm install

## Commands

Authenticate and print user token env vars:

npm run auth

Ingest archive snapshot only:

npm run ingest:archive

Ingest live recent data only:

npm run ingest:live -- --days 14

Analyze existing interaction records only:

npm run analyze -- --max-analyze 500

Check current Mongo counts:

npm run status

Run local API service:

npm run serve

Validate a simulation scenario manifest and agent modules:

npm run sim:validate -- --scenario ./public/anselm/tuvalu/baseline

Run a simulation (in-memory, deterministic by seed):

npm run sim:run -- --scenario ./public/anselm/tuvalu/baseline --ticks 365 --seed 42

Summarize the latest simulation run artifact:

npm run sim:report

Convenience full pipeline:

npm run scan

Dry-run full pipeline:

npm run scan:dry

## Live Merge Pattern

Recommended workflow for your current case:

1. Run archive ingest once to load the Twitter export up to the early-April snapshot.
2. Run live ingest with --days 14 to pull the recent gap from the live service.
3. Re-run live ingest whenever needed; everything upserts by stable per-user keys.
4. Run analysis separately when you want semantic tagging refreshed.

## What Gets Ingested

Archive ingest:

- twitter_posts from raw_ingestion_data/twitter/data/tweets.js
- likes/hearts from like.js
- repost interactions inferred from tweets.js

Live ingest:

- recent authored posts from the user timeline
- current bookmarks when user auth is available
- current likes when user auth is available
- recent reposts from the user timeline when user auth is available

Analysis:

- dereferences URLs found in interactions
- tags interactions for:
  - llm-design
  - economic
  - polymarket

## Environment

Loaded from project root .env.

Used values:

- MONGO_URI, optional, defaults to mongodb://127.0.0.1:27017
- TWITTER_BEARER_TOKEN or X_BEARER_TOKEN for app-level enrichment
- TWITTER_CONSUMER_KEY + TWITTER_SECRET_KEY for auth setup and OAuth1 user auth
- Optional user tokens for live user-context endpoints:
  - TWITTER_ACCESS_TOKEN + TWITTER_ACCESS_TOKEN_SECRET
  - TWITTER_OAUTH2_ACCESS_TOKEN

If you only have app credentials right now, archive ingest still works and live timeline fetch may work depending on endpoint access. User-context endpoints like bookmarks and likes need user auth.

## API Service

The local service exposes:

- GET /health
- GET /stats
- POST /jobs/ingest-archive
- POST /jobs/ingest-live
- POST /jobs/analyze

Default bind:

http://127.0.0.1:4317

## Common Flags

- --db scannerdata
- --mongo-uri mongodb://127.0.0.1:27017
- --data-dir ../../raw_ingestion_data/twitter/data
- --user-key anselm
- --username anselm
- --days 14
- --max-analyze 500
- --port 4317
- --dry-run
- --no-twitter-api
- --no-bookmarks-api
- --no-likes-api
- --no-reposts-api
- --no-posts-api

Simulation flags:

- --scenario ./public/anselm/tuvalu/baseline
- --ticks 365
- --dt 1
- --seed 42
- --out-dir ./runs/sim
- --run-id custom-run-id

## Simulation Architecture (Sketch)

- Each run loads one folder-backed manifest from public/....
- The engine executes fully in RAM and only writes final run artifacts.
- State updates are double-buffered so all agents read a frozen snapshot each tick.
- Events are queued per tick; emitted events are delivered at least one tick later.
- Spatial hash buckets accelerate neighborhood queries for proximity-based behavior.
- Spawn/despawn requests are staged and committed at tick boundaries.

## Idempotency Pattern

- posts upsert on userKey + tweetId
- interactions upsert on userKey + source + interactionType + tweetId
- subjects upsert on userKey + canonicalUrl
- analysis can be re-run independently of collection
