import {
  analyzeInteractions,
  getStats,
  ingestArchive,
  ingestLive,
  parseOptions,
  runCompositeScan,
  serveApi
} from "./lib/core.js";
import { runAuthFlow } from "./lib/auth.js";
import { parseSimOptions } from "./lib/sim/options.js";
import { runScenario, summarizeRun, validateScenario } from "./lib/sim/commands.js";

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function printHelp() {
  console.log(`twitter-scanner commands:

  auth
  ingest-archive
  ingest-live
  analyze
  status
  serve
  scan
  sim-validate
  sim-run
  sim-report

Common flags:
  --db scannerdata
  --mongo-uri mongodb://127.0.0.1:27017
  --user-key anselm
  --username anselm
  --days 14
  --max-analyze 500
  --dry-run

Sim flags:
  --scenario ./public/anselm/tuvalu/baseline
  --ticks 365
  --dt 1
  --seed 42
  --out-dir ./runs/sim
  --run-id 2026-...-tuvalu-baseline-sketch
`);
}

async function main() {
  const command = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "scan";
  const flagArgs = command === "scan" && (!process.argv[2] || process.argv[2].startsWith("--"))
    ? process.argv.slice(2)
    : process.argv.slice(3);
  const simCommands = new Set(["sim-validate", "sim-run", "sim-report"]);
  const options = simCommands.has(command) ? parseSimOptions(flagArgs) : parseOptions(flagArgs);

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "auth") {
    await runAuthFlow();
    return;
  }

  if (command === "ingest-archive") {
    printJson(await ingestArchive(options));
    return;
  }

  if (command === "ingest-live") {
    printJson(await ingestLive(options));
    return;
  }

  if (command === "analyze") {
    printJson(await analyzeInteractions(options));
    return;
  }

  if (command === "status") {
    printJson(await getStats(options));
    return;
  }

  if (command === "serve") {
    await serveApi(options);
    console.log(`twitter-scanner api listening on http://127.0.0.1:${options.port}`);
    return;
  }

  if (command === "scan") {
    printJson(await runCompositeScan(options));
    return;
  }

  if (command === "sim-validate") {
    printJson(await validateScenario(options));
    return;
  }

  if (command === "sim-run") {
    printJson(await runScenario(options));
    return;
  }

  if (command === "sim-report") {
    printJson(await summarizeRun(options));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error("twitter-scanner failed:", error);
  process.exitCode = 1;
});
