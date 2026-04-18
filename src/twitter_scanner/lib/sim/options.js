import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..", "..");

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function parseSimOptions(args) {
  const options = {
    scenarioDir: path.join(PROJECT_ROOT, "public", "anselm", "tuvalu", "baseline"),
    ticks: 365,
    dt: 1,
    seed: 42,
    outDir: path.join(PROJECT_ROOT, "runs", "sim"),
    runId: null
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if (arg === "--scenario" && next) {
      options.scenarioDir = path.resolve(next);
      i += 1;
    } else if (arg === "--ticks" && next) {
      options.ticks = parseInteger(next, options.ticks);
      i += 1;
    } else if (arg === "--dt" && next) {
      options.dt = parseInteger(next, options.dt);
      i += 1;
    } else if (arg === "--seed" && next) {
      options.seed = parseInteger(next, options.seed);
      i += 1;
    } else if (arg === "--out-dir" && next) {
      options.outDir = path.resolve(next);
      i += 1;
    } else if (arg === "--run-id" && next) {
      options.runId = next;
      i += 1;
    }
  }

  return options;
}
