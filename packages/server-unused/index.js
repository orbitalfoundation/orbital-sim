// @orbital/server — HTTP + WebSocket gateway to the orbital bus.
// Serves public/ as static files and exposes a sim API over REST + socket.io.
//
// Usage:
//   node packages/server/index.js
//   PORT=8080 node packages/server/index.js

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server as SocketIO } from 'socket.io';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSim, stopSim, listSims, getSim, simEvents } from './sim-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const PORT = Number(process.env.PORT ?? 3000);

const fastify = Fastify({ logger: true });

// Serve orbital-client.js from this package
fastify.get('/orbital-client.js', (req, reply) =>
  reply.sendFile('orbital-client.js', __dirname));

// Serve the project's public/ tree at /
fastify.register(fastifyStatic, {
  root: resolve(projectRoot, 'public'),
  prefix: '/',
  decorateReply: false,
});

// --- sim API ---

fastify.post('/api/sim', async (req, reply) => {
  const { manifest, hz, dt } = req.body ?? {};
  if (!manifest) return reply.code(400).send({ error: 'manifest required' });
  try {
    const sim = await startSim(manifest, { hz, dt });
    return { id: sim.id };
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ error: err.message });
  }
});

fastify.delete('/api/sim/:id', async (req, reply) => {
  if (!stopSim(req.params.id)) return reply.code(404).send({ error: 'not found' });
  return { ok: true };
});

fastify.get('/api/sim', async () => listSims());

fastify.get('/api/sim/:id', async (req, reply) => {
  const sim = getSim(req.params.id);
  if (!sim) return reply.code(404).send({ error: 'not found' });
  return { id: sim.id, manifestPath: sim.manifestPath, hz: sim.hz, dt: sim.dt, startedAt: sim.startedAt };
});

// --- start ---

await fastify.listen({ port: PORT, host: '0.0.0.0' });

// Attach socket.io after listen so fastify.server is bound
const io = new SocketIO(fastify.server, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.on('subscribe',   (id) => socket.join(id));
  socket.on('unsubscribe', (id) => socket.leave(id));
});

// Forward sim events to the relevant socket.io room
simEvents.on('tick',    ({ id, ...data }) => io.to(id).emit('tick',    data));
simEvents.on('stopped', ({ id })          => io.to(id).emit('stopped', {}));
