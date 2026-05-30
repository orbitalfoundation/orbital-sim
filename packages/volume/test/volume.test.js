import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '@orbital/bus';
import { volumeHandler } from '@orbital/volume';

function makeBus() {
  const bus = createBus();
  bus.register(volumeHandler);
  return bus;
}

test('bus.volume is installed on first entity with volume', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'a', volume: { ll: [-122, 49, 0] } });
  assert.ok(bus.volume, 'bus.volume should be set');
  assert.equal(bus.volume.size, 1);
});

test('point query returns nearby entity', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'tower', volume: { ll: [-122.0, 49.0, 100] } });

  // query 500 m from the tower — should find it
  const hits = await bus.resolve({ volume_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'tower');
});

test('point query excludes distant entity', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'far', volume: { ll: [-130.0, 55.0, 0] } });

  const hits = await bus.resolve({ volume_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(hits.length, 0);
});

test('llextent entity is indexed and queryable', async () => {
  const bus = makeBus();
  // a 1-degree bounding box centred near Vancouver
  await bus.resolve({ id: 'region', volume: { llextent: [[-123, 49, 0], [-122, 50, 0]] } });

  // query at the centre — 1 km radius
  const hits = await bus.resolve({ volume_query: { near: [-122.5, 49.5], radius: 1000 } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'region');
});

test('upsert moves entity to new position', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'drifter', volume: { ll: [-122.0, 49.0, 0] } });
  // move it far away
  await bus.resolve({ id: 'drifter', volume: { ll: [-10.0, 10.0, 0] } });

  const near = await bus.resolve({ volume_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(near.length, 0, 'should not be at old position');

  const far = await bus.resolve({ volume_query: { near: [-10.0, 10.0], radius: 500 } });
  assert.equal(far.length, 1, 'should be at new position');
});

test('entities without id are ignored', async () => {
  const bus = makeBus();
  await bus.resolve({ volume: { ll: [-122.0, 49.0, 0] } }); // no id
  assert.equal(bus.volume?.size ?? 0, 0);
});

test('direct bus.volume.query works', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'p', volume: { ll: [0, 0, 0] } });
  const hits = bus.volume.query({ near: [0, 0], radius: 100 });
  assert.equal(hits.length, 1);
});
