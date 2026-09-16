#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { classify } from "./classify.mjs";
import { parseCoreYaml } from "./parse-core.mjs";

function usage(code = 0) {
  const msg = `forge-classify — classify feedback against an optional core.yaml

Usage:
  forge-classify --ask "..." [--core path/to/core.yaml] [--json]
  echo "..." | forge-classify [--core path/to/core.yaml] [--json]

Options:
  --ask, -a     Feedback text (or pass via stdin)
  --core, -c    Path to target core.yaml (optional)
  --json, -j    Machine-readable JSON on stdout
  --help, -h    Show help
`;
  process.stdout.write(msg);
  process.exit(code);
}

function parseArgs(argv) {
  const out = { ask: null, core: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") usage(0);
    else if (a === "--json" || a === "-j") out.json = true;
    else if ((a === "--ask" || a === "-a") && argv[i + 1]) out.ask = argv[++i];
    else if ((a === "--core" || a === "-c") && argv[i + 1]) out.core = argv[++i];
    else if (a.startsWith("--ask=")) out.ask = a.slice("--ask=".length);
    else if (a.startsWith("--core=")) out.core = a.slice("--core=".length);
    else if (!a.startsWith("-") && !out.ask) out.ask = a;
    else {
      process.stderr.write(`Unknown argument: ${a}\n`);
      usage(1);
    }
  }
  return out;
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const args = parseArgs(process.argv.slice(2));
let ask = args.ask;
if (!ask || !ask.trim()) {
  const stdin = readStdin();
  if (stdin && stdin.trim()) ask = stdin.trim();
}
if (!ask || !ask.trim()) {
  process.stderr.write("Missing --ask (or stdin).\n");
  usage(1);
}

let core = null;
if (args.core) {
  const text = readFileSync(resolve(args.core), "utf8");
  core = parseCoreYaml(text);
}

const result = classify(ask, core);

if (args.json) {
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} else {
  process.stdout.write(`class: ${result.class}\n`);
  process.stdout.write(`rationale: ${result.rationale}\n`);
  process.stdout.write(`allowed_next_step: ${result.allowed_next_step}\n`);
  if (result.core_present) {
    process.stdout.write(
      `approvers.behavioral: ${(result.approvers.behavioral || []).join(", ") || "(none)"}\n`
    );
    process.stdout.write(
      `approvers.core: ${(result.approvers.core || []).join(", ") || "(none)"}\n`
    );
  } else {
    process.stdout.write("core.yaml: (not provided)\n");
  }
}
