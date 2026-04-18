function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function structuredCloneSafe(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function getCellKey(position, cellSize) {
  const x = Number.isFinite(position?.x) ? position.x : 0;
  const y = Number.isFinite(position?.y) ? position.y : 0;
  const cx = Math.floor(x / cellSize);
  const cy = Math.floor(y / cellSize);
  return `${cx}:${cy}`;
}

function distanceSquared(a, b) {
  const dx = (a?.x || 0) - (b?.x || 0);
  const dy = (a?.y || 0) - (b?.y || 0);
  return dx * dx + dy * dy;
}

function buildSpatialIndex(agentsById, cellSize) {
  const index = new Map();

  for (const agent of agentsById.values()) {
    if (!agent.alive) {
      continue;
    }

    const key = getCellKey(agent.position, cellSize);
    const bucket = index.get(key) || [];
    bucket.push(agent.id);
    index.set(key, bucket);
  }

  return index;
}

function queryNeighbors({ subjectId, radius, readAgents, spatialIndex, cellSize }) {
  const subject = readAgents.get(subjectId);
  if (!subject) {
    return [];
  }

  const x = subject.position?.x || 0;
  const y = subject.position?.y || 0;
  const r = Math.max(0, radius || 0);
  const cellRadius = Math.ceil(r / cellSize);
  const originCx = Math.floor(x / cellSize);
  const originCy = Math.floor(y / cellSize);
  const maxDistSq = r * r;
  const results = [];

  for (let dx = -cellRadius; dx <= cellRadius; dx += 1) {
    for (let dy = -cellRadius; dy <= cellRadius; dy += 1) {
      const key = `${originCx + dx}:${originCy + dy}`;
      const bucket = spatialIndex.get(key) || [];

      for (const candidateId of bucket) {
        if (candidateId === subjectId) {
          continue;
        }

        const candidate = readAgents.get(candidateId);
        if (!candidate || !candidate.alive) {
          continue;
        }

        if (distanceSquared(subject.position, candidate.position) <= maxDistSq) {
          results.push({
            id: candidate.id,
            type: candidate.type,
            state: structuredCloneSafe(candidate.state),
            params: structuredCloneSafe(candidate.params),
            position: structuredCloneSafe(candidate.position),
            tags: structuredCloneSafe(candidate.tags || [])
          });
        }
      }
    }
  }

  return results;
}

function resolveEventsForAgent(agentId, eventsForTick) {
  return eventsForTick.filter((event) => {
    if (event.target === "*" || event.target == null) {
      return true;
    }

    if (Array.isArray(event.target)) {
      return event.target.includes(agentId);
    }

    return event.target === agentId;
  });
}

function normalizePatchResult(result) {
  if (!result) {
    return {
      patch: null,
      position: null,
      emit: [],
      spawns: [],
      despawn: false
    };
  }

  return {
    patch: result.patch || null,
    position: result.position || null,
    emit: Array.isArray(result.emit) ? result.emit : [],
    spawns: Array.isArray(result.spawns) ? result.spawns : [],
    despawn: Boolean(result.despawn)
  };
}

function makeRunId(name) {
  const stamp = new Date().toISOString().replace(/[.:]/g, "-");
  const slug = String(name || "sim").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${stamp}-${slug}`;
}

function buildInitialAgentMap(manifest) {
  const map = new Map();
  for (const instance of manifest.instances) {
    map.set(instance.id, {
      id: instance.id,
      type: instance.agentType,
      state: structuredCloneSafe(instance.state || {}),
      params: structuredCloneSafe(instance.params || {}),
      position: structuredCloneSafe(instance.position || { x: 0, y: 0 }),
      tags: structuredCloneSafe(instance.tags || []),
      alive: true
    });
  }
  return map;
}

export async function runSimulation({ manifest, agentRegistry, options }) {
  const ticks = options.ticks;
  const dt = options.dt;
  const seed = options.seed;
  const cellSize = manifest?.space?.cellSize || 1;
  const random = mulberry32(seed);

  let readAgents = buildInitialAgentMap(manifest);
  let writeAgents = new Map();

  const eventsByTick = new Map();
  for (const event of manifest.initialEvents || []) {
    const tick = Number.isFinite(event.tick) ? event.tick : 0;
    const queue = eventsByTick.get(tick) || [];
    queue.push(structuredCloneSafe(event));
    eventsByTick.set(tick, queue);
  }

  const metrics = {
    totalTicks: ticks,
    births: 0,
    deaths: 0,
    emittedEvents: 0,
    populationByTick: []
  };

  for (let tick = 0; tick < ticks; tick += 1) {
    const spatialIndex = buildSpatialIndex(readAgents, cellSize);
    const eventsForTick = eventsByTick.get(tick) || [];
    const spawnsRequested = [];
    const despawnsRequested = new Set();

    writeAgents = new Map();

    const sortedIds = [...readAgents.keys()].sort();
    for (const id of sortedIds) {
      const current = readAgents.get(id);
      if (!current || !current.alive) {
        continue;
      }

      const entry = agentRegistry.get(current.type);
      if (!entry) {
        throw new Error(`Unknown agent type '${current.type}' referenced by instance '${current.id}'`);
      }

      const implementation = entry.implementation;
      const inbox = resolveEventsForAgent(id, eventsForTick);
      let nextState = structuredCloneSafe(current.state);
      let nextPosition = structuredCloneSafe(current.position);

      if (typeof implementation.onEvents === "function" && inbox.length > 0) {
        const eventResult = normalizePatchResult(
          implementation.onEvents({
            tick,
            dt,
            random,
            inbox,
            self: {
              id: current.id,
              type: current.type,
              state: structuredCloneSafe(current.state),
              params: structuredCloneSafe(current.params),
              position: structuredCloneSafe(current.position),
              tags: structuredCloneSafe(current.tags)
            },
            view: {
              neighbors: (radius) => queryNeighbors({
                subjectId: current.id,
                radius,
                readAgents,
                spatialIndex,
                cellSize
              })
            }
          })
        );

        if (eventResult.patch) {
          nextState = { ...nextState, ...eventResult.patch };
        }
        if (eventResult.position) {
          nextPosition = { ...nextPosition, ...eventResult.position };
        }

        for (const outgoing of eventResult.emit) {
          const delay = Math.max(1, Number.isFinite(outgoing.delay) ? outgoing.delay : 1);
          const outTick = tick + delay;
          const queue = eventsByTick.get(outTick) || [];
          queue.push({
            ...outgoing,
            source: current.id,
            tick: outTick
          });
          metrics.emittedEvents += 1;
          eventsByTick.set(outTick, queue);
        }

        for (const spawn of eventResult.spawns) {
          spawnsRequested.push({ source: current.id, ...spawn });
        }

        if (eventResult.despawn) {
          despawnsRequested.add(current.id);
        }
      }

      const stepResult = normalizePatchResult(
        implementation.step({
          tick,
          dt,
          random,
          self: {
            id: current.id,
            type: current.type,
            state: structuredCloneSafe(nextState),
            params: structuredCloneSafe(current.params),
            position: structuredCloneSafe(nextPosition),
            tags: structuredCloneSafe(current.tags)
          },
          view: {
            neighbors: (radius) => queryNeighbors({
              subjectId: current.id,
              radius,
              readAgents,
              spatialIndex,
              cellSize
            })
          }
        })
      );

      if (stepResult.patch) {
        nextState = { ...nextState, ...stepResult.patch };
      }
      if (stepResult.position) {
        nextPosition = { ...nextPosition, ...stepResult.position };
      }

      for (const outgoing of stepResult.emit) {
        const delay = Math.max(1, Number.isFinite(outgoing.delay) ? outgoing.delay : 1);
        const outTick = tick + delay;
        const queue = eventsByTick.get(outTick) || [];
        queue.push({
          ...outgoing,
          source: current.id,
          tick: outTick
        });
        metrics.emittedEvents += 1;
        eventsByTick.set(outTick, queue);
      }

      for (const spawn of stepResult.spawns) {
        spawnsRequested.push({ source: current.id, ...spawn });
      }

      if (stepResult.despawn) {
        despawnsRequested.add(current.id);
      }

      writeAgents.set(current.id, {
        ...current,
        state: nextState,
        position: nextPosition,
        alive: !despawnsRequested.has(current.id)
      });
    }

    for (const [id, agent] of writeAgents) {
      if (!agent.alive) {
        writeAgents.delete(id);
        metrics.deaths += 1;
      }
    }

    for (const spawn of spawnsRequested) {
      const spawnId = spawn.id || `${spawn.agentType || "agent"}-${tick}-${Math.floor(random() * 1e9)}`;
      if (writeAgents.has(spawnId)) {
        continue;
      }

      writeAgents.set(spawnId, {
        id: spawnId,
        type: spawn.agentType,
        state: structuredCloneSafe(spawn.state || {}),
        params: structuredCloneSafe(spawn.params || {}),
        position: structuredCloneSafe(spawn.position || { x: 0, y: 0 }),
        tags: structuredCloneSafe(spawn.tags || []),
        alive: true
      });
      metrics.births += 1;
    }

    readAgents = writeAgents;
    metrics.populationByTick.push({ tick, count: readAgents.size });
  }

  return {
    runId: options.runId || makeRunId(manifest.name),
    scenarioName: manifest.name,
    ticks,
    dt,
    seed,
    finishedAt: new Date().toISOString(),
    metrics,
    finalPopulation: readAgents.size,
    finalAgents: [...readAgents.values()].map((agent) => ({
      id: agent.id,
      type: agent.type,
      state: agent.state,
      params: agent.params,
      position: agent.position,
      tags: agent.tags
    }))
  };
}
