import { parseSimOptions } from "./lib/sim/options.js";
import { runScenario, summarizeRun, validateScenario } from "./lib/sim/commands.js";

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function printHelp() {
  console.log(`simulation-engine commands:

  sim-validate
  sim-run
  sim-report

Flags:
  --scenario ./public/anselm/tuvalu/baseline
  --ticks 365
  --dt 1
  --seed 42
  --out-dir ./runs/sim
  --run-id 2026-...-tuvalu-baseline-sketch
`);
}

async function main() {
  const command = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "sim-run";
  const flagArgs = command === "sim-run" && (!process.argv[2] || process.argv[2].startsWith("--"))
    ? process.argv.slice(2)
    : process.argv.slice(3);
  const options = parseSimOptions(flagArgs);

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
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
  console.error("simulation-engine failed:", error);
  process.exitCode = 1;
});
