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
  // child gets { registered: true } at registration time, not the load event that triggered it
  assert.deepEqual(received, ['other']);

  await sim.resolve({ tick: true });
  assert.deepEqual(received, ['other', 'tick']);
});

test('resolve ignores invalid non-object events', async (t) => {
  const sim = createBus();
  await assert.doesNotReject(async () => sim.resolve(null));
  await assert.doesNotReject(async () => sim.resolve(42));
  await assert.doesNotReject(async () => sim.resolve('hello'));
});

test('obliterate removes a resolver after it has seen the event', async () => {
  const sim = createBus();
  let sawObliterate = false;
  const agent = {
    id: 'removable',
    resolve(event) {
      if (event.registered) return;
      if (event.obliterate) sawObliterate = true;
    },
  };
  sim.register(agent);
  assert.strictEqual(sim.has('removable'), true);
  await sim.resolve({ id: 'removable', obliterate: true });
  assert.strictEqual(sawObliterate, true, 'handler saw the obliterate event before removal');
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
  const result = await sim.resolve({ load: './test/empty-manifest.js' });

  assert.strictEqual(result?.agents?.length, 1);
  assert.strictEqual(sim.has('logger'), true);
});
