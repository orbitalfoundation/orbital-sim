import test from 'node:test';
import assert from 'node:assert/strict';
import { elevationHandler } from '../index.js';

function makeBus() {
  const bus = {
    installed: {},
    install(name, svc) {
      if (bus.installed[name]) return false;
      bus.installed[name] = svc;
      bus[name] = svc;
      return true;
    },
    resolve() {},
  };
  return bus;
}

test('installs bus.elevation on registered', async () => {
  const bus = makeBus();
  await elevationHandler.resolve({ registered: true }, bus);
  assert.ok(bus.elevation);
  assert.strictEqual(typeof bus.elevation.sample, 'function');
  assert.strictEqual(typeof bus.elevation.load, 'function');
});

test('sample returns null before any raster is loaded', async () => {
  const bus = makeBus();
  await elevationHandler.resolve({ registered: true }, bus);
  assert.strictEqual(bus.elevation.sample(0, 0), null);
  assert.strictEqual(bus.elevation.sample(-122, 49), null);
});

test('elevation_query returns null with no raster', async () => {
  const bus = makeBus();
  await elevationHandler.resolve({ registered: true }, bus);
  const result = await elevationHandler.resolve({ elevation_query: { lon: 0, lat: 0 } }, bus);
  assert.strictEqual(result, null);
});

test('placeholder elevation component is silently ignored', async () => {
  const bus = makeBus();
  await elevationHandler.resolve({ registered: true }, bus);
  const result = await elevationHandler.resolve({
    elevation: { target: '/nonexistent.u16', status: 'placeholder' },
  }, bus);
  assert.strictEqual(result, undefined);
  assert.strictEqual(bus.elevation.sample(0, 0), null);
});
