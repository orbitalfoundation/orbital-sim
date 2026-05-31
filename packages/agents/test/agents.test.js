import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '@orbital/bus';
import { spatialHandler } from '../spatial.js';
import elevationAgent from '../elevation.js';
import insolationAgent from '../insolation.js';

// --- spatial ---

function spatialBus() {
  const bus = createBus();
  bus.register(spatialHandler);
  return bus;
}

test('spatial: installs bus.spatial on registered', () => {
  const bus = spatialBus();
  assert.ok(bus.spatial);
});

test('spatial: point query returns nearby entity', async () => {
  const bus = spatialBus();
  await bus.resolve({ id: 'tower', spatial: { ll: [-122.0, 49.0, 0] } });
  const hits = await bus.resolve({ spatial_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'tower');
});

test('spatial: query excludes distant entity', async () => {
  const bus = spatialBus();
  await bus.resolve({ id: 'far', spatial: { ll: [-130.0, 55.0, 0] } });
  const hits = await bus.resolve({ spatial_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(hits.length, 0);
});

test('spatial: upsert moves entity to new position', async () => {
  const bus = spatialBus();
  await bus.resolve({ id: 'drifter', spatial: { ll: [-122.0, 49.0, 0] } });
  await bus.resolve({ id: 'drifter', spatial: { ll: [-10.0, 10.0, 0] } });
  const near = await bus.resolve({ spatial_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(near.length, 0);
  const far = await bus.resolve({ spatial_query: { near: [-10.0, 10.0], radius: 500 } });
  assert.equal(far.length, 1);
});

// --- elevation ---

function elevBus() {
  const bus = createBus();
  bus.register(Object.assign({}, elevationAgent));
  return bus;
}

test('elevation: installs bus.elevation on registered', () => {
  const bus = elevBus();
  assert.ok(bus.elevation);
  assert.equal(typeof bus.elevation.sample, 'function');
});

test('elevation: cosine fallback when no raster loaded', () => {
  const bus = elevBus();
  // equator → 1000, pole → 0
  assert.ok(Math.abs(bus.elevation.sample(0, 0) - 1000) < 1);
  assert.ok(Math.abs(bus.elevation.sample(0, 90)) < 1);
});

test('elevation: placeholder component ignored', async () => {
  const bus = elevBus();
  await bus.resolve({ elevation: { target: '/nonexistent.i16', status: 'placeholder' } });
  assert.equal(bus.elevation.sample(0, 0), 1000);
});

// --- insolation ---

function insolBus(overrides = {}) {
  const bus = createBus();
  bus.register(Object.assign({}, insolationAgent, overrides));
  return bus;
}

test('insolation: installs bus.insolation on registered', () => {
  const bus = insolBus();
  assert.ok(bus.insolation);
  assert.equal(typeof bus.insolation.cells, 'function');
  assert.equal(typeof bus.insolation.at, 'function');
});

test('insolation: cells match lats×lons grid', () => {
  const lats = [-30, 0, 30];
  const lons = [-90, 0, 90];
  const bus = insolBus({ lats, lons });
  assert.equal(bus.insolation.cells().length, 9);
});

test('insolation: seeds bus.time from t0', () => {
  const bus = insolBus({ t0: '2026-06-21T12:00:00Z' });
  assert.equal(bus.time, new Date('2026-06-21T12:00:00Z').getTime() / 1000);
});

test('insolation: tsi values update on tick', async () => {
  const bus = insolBus({ lats: [0], lons: [0], t0: '2026-06-21T12:00:00Z' });
  const before = bus.insolation.at(0);
  await bus.resolve({ tick: 1, t: bus.time + 21600, dt: 21600 });
  const after = bus.insolation.at(0);
  assert.notEqual(before, after);
});
