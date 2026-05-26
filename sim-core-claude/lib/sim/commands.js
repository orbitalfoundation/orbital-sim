import path from "node:path";
import {
  loadAgentRegistry,
  loadScenarioManifest,
  readLatestRunArtifact,
  readRunArtifact,
  validateManifestShape,
  writeRunArtifact
} from "./io.js";
import { runSimulation } from "./engine.js";

export async function validateScenario(options) {
  const { manifestPath, scenarioDir, manifest } = await loadScenarioManifest(options.scenarioDir);
  const shapeErrors = validateManifestShape(manifest);

  let loadErrors = [];
  if (shapeErrors.length === 0) {
    try {
      const registry = await loadAgentRegistry(manifest, scenarioDir);
      for (const instance of manifest.instances) {
        if (!registry.has(instance.agentType)) {
          loadErrors.push(`Instance '${instance.id}' references unknown agentType '${instance.agentType}'`);
        }
      }
    } catch (error) {
      loadErrors.push(error.message);
    }
  }

  return {
    ok: shapeErrors.length === 0 && loadErrors.length === 0,
    manifestPath,
    errors: [...shapeErrors, ...loadErrors],
    checks: {
      modules: manifest.agentModules?.length || 0,
      instances: manifest.instances?.length || 0,
      initialEvents: manifest.initialEvents?.length || 0
    }
  };
}

export async function runScenario(options) {
  const { scenarioDir, manifest } = await loadScenarioManifest(options.scenarioDir);
  const validation = validateManifestShape(manifest);
  if (validation.length > 0) {
    return {
      ok: false,
      errors: validation
    };
  }

  const registry = await loadAgentRegistry(manifest, scenarioDir);
  const result = await runSimulation({
    manifest,
    agentRegistry: registry,
    options
  });

  const payload = {
    metadata: {
      scenarioDir: path.resolve(options.scenarioDir),
      generatedAt: new Date().toISOString()
    },
    result
  };

  const runPath = await writeRunArtifact({
    outDir: options.outDir,
    runId: result.runId,
    payload
  });

  return {
    ok: true,
    runId: result.runId,
    runPath,
    scenarioName: result.scenarioName,
    finalPopulation: result.finalPopulation,
    metrics: result.metrics
  };
}

export async function summarizeRun(options) {
  const artifact = options.runId
    ? await readRunArtifact(options.outDir, options.runId)
    : await readLatestRunArtifact(options.outDir);

  const result = artifact.payload.result;
  const populationSeries = result.metrics.populationByTick || [];
  const startPopulation = populationSeries[0]?.count ?? null;
  const endPopulation = populationSeries[populationSeries.length - 1]?.count ?? result.finalPopulation;

  return {
    ok: true,
    runPath: artifact.runPath,
    runId: result.runId,
    scenarioName: result.scenarioName,
    ticks: result.ticks,
    seed: result.seed,
    startPopulation,
    endPopulation,
    births: result.metrics.births,
    deaths: result.metrics.deaths,
    emittedEvents: result.metrics.emittedEvents
  };
}
