import fs from "node:fs/promises";
import path from "node:path";

export async function loadScenarioManifest(scenarioDir) {
  const manifestPath = path.join(scenarioDir, "manifest.json");
  const raw = await fs.readFile(manifestPath, "utf8");
  const manifest = JSON.parse(raw);

  return {
    manifestPath,
    scenarioDir,
    manifest
  };
}

export async function loadAgentRegistry(manifest, scenarioDir) {
  const registry = new Map();
  const modules = manifest.agentModules || [];

  for (const moduleSpec of modules) {
    if (!moduleSpec?.id || !moduleSpec?.path) {
      throw new Error("Each agent module entry needs id and path");
    }

    const absPath = path.resolve(scenarioDir, moduleSpec.path);
    const mod = await import(absPath);
    const implementation = mod.default || mod.agent || null;

    if (!implementation || typeof implementation.step !== "function") {
      throw new Error(`Agent module ${moduleSpec.id} must export a default object with step(context)`);
    }

    registry.set(moduleSpec.id, {
      id: moduleSpec.id,
      path: absPath,
      implementation
    });
  }

  return registry;
}

export function validateManifestShape(manifest) {
  const errors = [];

  if (!manifest || typeof manifest !== "object") {
    errors.push("Manifest must be a JSON object");
    return errors;
  }

  if (!manifest.name || typeof manifest.name !== "string") {
    errors.push("Manifest requires a string 'name'");
  }

  if (!Array.isArray(manifest.agentModules) || manifest.agentModules.length === 0) {
    errors.push("Manifest requires non-empty 'agentModules' array");
  }

  if (!Array.isArray(manifest.instances) || manifest.instances.length === 0) {
    errors.push("Manifest requires non-empty 'instances' array");
  }

  for (const instance of manifest.instances || []) {
    if (!instance.id || !instance.agentType) {
      errors.push("Each instance requires id and agentType");
    }
  }

  return errors;
}

export async function writeRunArtifact({ outDir, runId, payload }) {
  await fs.mkdir(outDir, { recursive: true });
  const runPath = path.join(outDir, `${runId}.json`);
  await fs.writeFile(runPath, JSON.stringify(payload, null, 2));
  return runPath;
}

export async function readRunArtifact(outDir, runId) {
  const runPath = path.join(outDir, `${runId}.json`);
  const raw = await fs.readFile(runPath, "utf8");
  return {
    runPath,
    payload: JSON.parse(raw)
  };
}

export async function readLatestRunArtifact(outDir) {
  const names = await fs.readdir(outDir);
  const jsonNames = names.filter((name) => name.endsWith(".json")).sort();

  if (jsonNames.length === 0) {
    throw new Error(`No run artifacts in ${outDir}`);
  }

  const latest = jsonNames[jsonNames.length - 1];
  const runPath = path.join(outDir, latest);
  const raw = await fs.readFile(runPath, "utf8");

  return {
    runPath,
    payload: JSON.parse(raw)
  };
}
