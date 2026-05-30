import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../index.js';

test('resolver registered during resolve does not receive the current event', async (t) => {
  const sim = createBus();
  const received = [];

  const registrar = {
    id: 'registrar',
    resolve(event) {
      if (event.load) {
        sim.register({
          id: 'child',
          resolve(e) {
            received.push(e.tick ? 'tick' : 'other');
          },
        });
      }
    },
  };

  sim.register(registrar);
  await sim.resolve({ load: true });
  assert.deepEqual(received, []);

  await sim.resolve({ tick: true });
  assert.deepEqual(received, ['tick']);
});

test('resolve ignores invalid non-object events', async (t) => {
  const sim = createBus();
  await assert.doesNotReject(async () => sim.resolve(null));
  await assert.doesNotReject(async () => sim.resolve(42));
  await assert.doesNotReject(async () => sim.resolve('hello'));
});

test('remove event deletes a resolver', async (t) => {
  const sim = createBus();
  const agent = {
    id: 'removable',
    resolve() {
      throw new Error('should not run');
    },
  };
  sim.register(agent);
  assert.strictEqual(sim.has('removable'), true);
  await sim.resolve({ resolve_remove: 'removable' });
  assert.strictEqual(sim.has('removable'), false);
});

test('resolve handles arrays of events and registers embedded resolvers', async (t) => {
  const sim = createBus();
  const agent = {
    id: 'array-agent',
    resolve() {
      return;
    },
  };

  await sim.resolve([agent]);
  assert.strictEqual(sim.has('array-agent'), true);
});

test('manifest loader handles load event', async (t) => {
  const sim = createBus();
  const result = await sim.resolve({ load: 'manifest', manifest: './test/empty-manifest.js' });

  assert.strictEqual(result?.meta?.name, 'empty-system');
  assert.strictEqual(result?.agents?.length, 1);
  assert.strictEqual(sim.has('logger'), true);
  assert.strictEqual(sim.scenario.meta.name, 'empty-system');
});
