import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '@orbital/bus';
import { spatialHandler } from '@orbital/spatial';

function makeBus() {
  const bus = createBus();
  bus.register(spatialHandler);
  return bus;
}

test('bus.spatial is installed on first entity with spatial', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'a', spatial: { ll: [-122, 49, 0] } });
  assert.ok(bus.spatial, 'bus.spatial should be set');
  assert.equal(bus.spatial.size, 1);
});

test('point query returns nearby entity', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'tower', spatial: { ll: [-122.0, 49.0, 100] } });

  // query 500 m from the tower — should find it
  const hits = await bus.resolve({ spatial_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'tower');
});

test('point query excludes distant entity', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'far', spatial: { ll: [-130.0, 55.0, 0] } });

  const hits = await bus.resolve({ spatial_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(hits.length, 0);
});

test('llextent entity is indexed and queryable', async () => {
  const bus = makeBus();
  // a 1-degree bounding box centred near Vancouver
  await bus.resolve({ id: 'region', spatial: { llextent: [[-123, 49, 0], [-122, 50, 0]] } });

  // query at the centre — 1 km radius
  const hits = await bus.resolve({ spatial_query: { near: [-122.5, 49.5], radius: 1000 } });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 'region');
});

test('upsert moves entity to new position', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'drifter', spatial: { ll: [-122.0, 49.0, 0] } });
  // move it far away
  await bus.resolve({ id: 'drifter', spatial: { ll: [-10.0, 10.0, 0] } });

  const near = await bus.resolve({ spatial_query: { near: [-122.0, 49.0], radius: 500 } });
  assert.equal(near.length, 0, 'should not be at old position');

  const far = await bus.resolve({ spatial_query: { near: [-10.0, 10.0], radius: 500 } });
  assert.equal(far.length, 1, 'should be at new position');
});

test('entities without id are ignored', async () => {
  const bus = makeBus();
  await bus.resolve({ spatial: { ll: [-122.0, 49.0, 0] } }); // no id
  assert.equal(bus.spatial?.size ?? 0, 0);
});

test('direct bus.spatial.query works', async () => {
  const bus = makeBus();
  await bus.resolve({ id: 'p', spatial: { ll: [0, 0, 0] } });
  const hits = bus.spatial.query({ near: [0, 0], radius: 100 });
  assert.equal(hits.length, 1);
});
