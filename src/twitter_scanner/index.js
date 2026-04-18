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

Common flags:
  --db scannerdata
  --mongo-uri mongodb://127.0.0.1:27017
  --user-key anselm
  --username anselm
  --days 14
  --max-analyze 500
  --dry-run
`);
}

async function main() {
  const command = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "scan";
  const flagArgs = command === "scan" && (!process.argv[2] || process.argv[2].startsWith("--"))
    ? process.argv.slice(2)
    : process.argv.slice(3);
  const options = parseOptions(flagArgs);

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

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error("twitter-scanner failed:", error);
  process.exitCode = 1;
});
