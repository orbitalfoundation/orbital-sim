// @orbital/website-server
// Serves the Svelte app (website/dist/) and the public/ scenario tree.
// Public static files take priority: /area/project/index.html is served as-is
// before falling back to the SPA. API routes are mounted at /api.
//
// Usage:
//   node website/server/index.js
//   PORT=8080 node website/server/index.js

import Fastify           from 'fastify';
import fastifyStatic     from '@fastify/static';
import { Server as IO }  from 'socket.io';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, readFile, stat } from 'node:fs/promises';
import { constants }     from 'node:fs';
import { makeAreas }     from './areas.js';
import { startSim, stopSim, listSims, getSim, simEvents } from './sims.js';
import { createSession, getSession, deleteSession } from './sessions.js';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const publicRoot  = join(projectRoot, 'public');
const distRoot    = join(projectRoot, 'dist');       // built Svelte app
const PORT        = Number(process.env.PORT ?? 3000);
const CERT        = process.env.TLS_CERT;  // path to mkcert .pem
const KEY         = process.env.TLS_KEY;   // path to mkcert -key.pem

const httpsOpts = (CERT && KEY)
  ? { https: { cert: await readFile(CERT), key: await readFile(KEY) } }
  : {};

const fastify = Fastify({ logger: true, ...httpsOpts });
const areas   = makeAreas(publicRoot);

async function fileExists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

async function isFile(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

// Serve built Svelte assets at /_app/* (content-hashed filenames from Vite)
fastify.register(fastifyStatic, {
  root: join(distRoot, '_app'),
  prefix: '/_app/',
  decorateReply: true,
});

// Serve orbital-client.js from the old packages/server location
fastify.get('/orbital-client.js', async (req, reply) => {
  const p = join(projectRoot, 'packages/server/orbital-client.js');
  if (await fileExists(p)) return reply.type('application/javascript').send(await readFile(p, 'utf8'));
  return reply.code(404).send();
});

// --- API: home feed ---

fastify.get('/api/home', async (req, reply) => {
  const feed = await areas.homeFeed();
  if (!feed) return reply.code(404).send({ error: 'no home feed' });
  return feed;
});

// --- API: areas ---

fastify.get('/api/areas/:name', async (req, reply) => {
  const items = await areas.listArea(req.params.name);
  if (!items) return reply.code(404).send({ error: 'area not found' });
  return { items };
});

fastify.get('/api/areas/:name/:project', async (req, reply) => {
  const info = await areas.projectInfo(req.params.name, req.params.project);
  if (!info) return reply.code(404).send({ error: 'not found' });
  return info;
});

fastify.post('/api/areas/:name/:project', async (req, reply) => {
  const session = getSession(req.headers.authorization);
  if (!session) return reply.code(401).send({ error: 'unauthorized' });
  // Area name must match the session owner's email prefix
  // @todo use address/publicKey as the canonical owner once signing is in place
  const ownerArea = session.email?.split('@')[0]?.toLowerCase();
  if (ownerArea !== req.params.name.toLowerCase())
    return reply.code(403).send({ error: 'forbidden' });
  const ownerSlug = ownerArea; // slug == email prefix == area name
  try {
    const meta = { author: ownerSlug, ...(req.body ?? {}) };
    await areas.createProject(req.params.name, req.params.project, meta);
    return { ok: true, slug: req.params.project, author: ownerSlug, type: meta.type ?? 'other', title: meta.title ?? req.params.project };
  } catch (err) {
    return reply.code(409).send({ error: err.message });
  }
});

// --- API: sims ---

fastify.post('/api/sim', async (req, reply) => {
  const { manifest, hz, dt, maxTicks } = req.body ?? {};
  if (!manifest) return reply.code(400).send({ error: 'manifest required' });
  try {
    const sim = await startSim(manifest, { hz, dt, maxTicks: maxTicks ?? null });
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

fastify.get('/api/sim',     async () => listSims());
fastify.get('/api/sim/:id', async (req, reply) => {
  const sim = getSim(req.params.id);
  if (!sim) return reply.code(404).send({ error: 'not found' });
  return { id: sim.id, manifestPath: sim.manifestPath, hz: sim.hz, dt: sim.dt, startedAt: sim.startedAt };
});

// --- API: auth ---

fastify.post('/api/auth/session', async (req, reply) => {
  const { idToken } = req.body ?? {};
  if (!idToken) return reply.code(400).send({ error: 'idToken required' });
  try {
    const session = await createSession(idToken);
    return { token: session.token, email: session.email, name: session.name, address: session.address };
  } catch (err) {
    return reply.code(401).send({ error: err.message });
  }
});

fastify.delete('/api/auth/session', async (req) => {
  deleteSession(req.headers.authorization);
  return { ok: true };
});

// Expose session info so the client can verify a stored token is still valid
fastify.get('/api/auth/session', async (req, reply) => {
  const session = getSession(req.headers.authorization);
  if (!session) return reply.code(401).send({ error: 'invalid session' });
  return { email: session.email, name: session.name, profileImage: session.profileImage, address: session.address, publicKey: session.publicKey };
});

// --- Catch-all: public static files → SPA fallback ---

fastify.get('/*', async (req, reply) => {
  const path = req.params['*'] || '';

  // 1. Try public/<path>/index.html (scenario page)
  const publicIndex = join(publicRoot, path, 'index.html');
  if (await fileExists(publicIndex)) {
    const html = await readFile(publicIndex, 'utf8');
    return reply.type('text/html').send(html);
  }

  // 2. Try public/<path> as a direct file (skip directories)
  const publicFile = join(publicRoot, path);
  if (path && await isFile(publicFile)) {
    const buf = await readFile(publicFile);
    return reply.send(buf);
  }

  // 3. Serve the Svelte SPA (client-side routing handles the rest)
  const spaIndex = join(distRoot, 'index.html');
  if (await fileExists(spaIndex)) {
    const html = await readFile(spaIndex, 'utf8');
    return reply.type('text/html').send(html);
  }

  // 4. Dist not built yet — helpful message
  return reply.type('text/html').send(`
    <pre style="font-family:monospace;padding:2rem">
      Svelte app not built yet.
      Run: cd website/client && npm install && npm run build
    </pre>`);
});

// --- Start ---

await fastify.listen({ port: PORT, host: '0.0.0.0' });

const io = new IO(fastify.server, { cors: { origin: '*' } });

// Idle timeout: stop a sim after IDLE_MS with no socket subscribers.
// Prevents sims from running forever when a user navigates away.
const IDLE_MS    = 5 * 60 * 1000; // 5 minutes
const idleTimers = new Map();      // simId → timer handle

function clearIdleTimer(simId) {
  const t = idleTimers.get(simId);
  if (t) { clearTimeout(t); idleTimers.delete(simId); }
}

function scheduleIdleStop(simId) {
  if (idleTimers.has(simId)) return;
  if (!getSim(simId)) return;
  const t = setTimeout(() => {
    idleTimers.delete(simId);
    if (stopSim(simId)) fastify.log.info(`[sim] ${simId} stopped after idle timeout`);
  }, IDLE_MS);
  idleTimers.set(simId, t);
}

io.on('connection', socket => {
  // Track which sim rooms this socket joined so we can check them on disconnect.
  const joined = new Set();

  socket.on('subscribe', id => {
    socket.join(id);
    joined.add(id);
    clearIdleTimer(id); // client is back — cancel any pending stop
  });

  socket.on('unsubscribe', id => {
    socket.leave(id);
    joined.delete(id);
    if ((io.sockets.adapter.rooms.get(id)?.size ?? 0) === 0) scheduleIdleStop(id);
  });

  socket.on('disconnect', () => {
    // socket.io has already removed the socket from rooms by this point.
    for (const id of joined) {
      if ((io.sockets.adapter.rooms.get(id)?.size ?? 0) === 0) scheduleIdleStop(id);
    }
  });
});

simEvents.on('tick',    ({ id, ...data }) => io.to(id).emit('tick',    data));
simEvents.on('frame',   ({ id, ...data }) => io.to(id).emit('frame',   data));
simEvents.on('stopped', ({ id })          => {
  clearIdleTimer(id);      // sim ended — no need to wait for the timer
  io.to(id).emit('stopped', {});
});
