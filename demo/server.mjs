#!/usr/bin/env node
/**
 * Forge local intake — Change Conductor demo
 * Zero dependencies. Auto-picks a free port (never silently shares Jabuti's).
 *
 *   npm run demo
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { classify } from "../cli/classify.mjs";
import { parseCoreYaml } from "../cli/parse-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(__dirname, "public");
const PREFERRED = Number(process.env.PORT || 3847);
const HOST = process.env.HOST || "127.0.0.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, type = "text/plain; charset=utf-8") {
  const buf = Buffer.from(body);
  res.writeHead(status, {
    "Content-Type": type,
    "Content-Length": buf.length,
    "Cache-Control": "no-store",
    "X-Forge": "change-conductor",
  });
  res.end(buf);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj, null, 2), "application/json; charset=utf-8");
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function buildBrief(ask, result) {
  if (result.class !== "Core") return null;
  return {
    title: "LAUNCH ABORT — Core surface",
    ask,
    classification: result.class,
    rationale: result.rationale,
    matched_protected_paths: result.matched?.protected_paths || [],
    matched_invariants: result.matched?.invariants || [],
    approvers_core: result.approvers?.core || [],
    forge_will: "Hard stop. No implementation PR. Humans own this gate.",
    humans_should_decide: [
      "Can this be split into an Additive side path that leaves the core contract untouched?",
      "Who depends on these protected paths across teams?",
      "What would a scoped, reversible plan look like if Core approvers greenlight?",
    ],
  };
}

function laneCopy(klass) {
  if (klass === "Additive") {
    return {
      headline: "GREEN LANE — build it",
      jira: "Ticket → triage → backlog → maybe someday",
      forge: "Clarify → plan → branch → PR. Humans merge.",
    };
  }
  if (klass === "Behavioral") {
    return {
      headline: "YELLOW LANE — brake, then build",
      jira: "Same ticket pile, unclear risk, silent default flips",
      forge: "Named approver required before any code. Defaults are sacred.",
    };
  }
  return {
    headline: "RED LANE — abort to humans",
    jira: "Hope someone notices it touches the foundation",
    forge: "Refuse to implement. Open a Core brief. Protect the fleet.",
  };
}

async function handleClassify(req, res) {
  let payload;
  try {
    const raw = await readBody(req);
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }

  const ask = typeof payload.ask === "string" ? payload.ask : "";
  if (!ask.trim()) return sendJson(res, 400, { error: "Missing ask" });

  let core = null;
  if (typeof payload.core_yaml === "string" && payload.core_yaml.trim()) {
    try {
      core = parseCoreYaml(payload.core_yaml);
    } catch (err) {
      return sendJson(res, 400, {
        error: "Could not parse core_yaml",
        detail: String(err?.message || err),
      });
    }
  }

  const result = classify(ask, core);
  return sendJson(res, 200, {
    ...result,
    brief: buildBrief(ask, result),
    lane: laneCopy(result.class),
    product: "forge",
  });
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  rel = decodeURIComponent(rel).split("?")[0];
  if (rel.includes("..")) return send(res, 400, "Bad path");
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !existsSync(file)) {
    return send(res, 404, "Not found — this is Forge, not another local app");
  }
  send(res, 200, readFileSync(file), TYPES[extname(file)] || "application/octet-stream");
}

function createAppServer() {
  return createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${HOST}`);

    if (req.method === "GET" && url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        product: "forge",
        name: "Change Conductor",
        mark: "FORGE",
      });
    }

    if (req.method === "GET" && url.pathname === "/api/example-core") {
      const path = join(ROOT, "examples", "core.example.yaml");
      if (!existsSync(path)) return sendJson(res, 404, { error: "example missing" });
      return send(res, 200, readFileSync(path, "utf8"), "text/yaml; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/api/examples") {
      return sendJson(res, 200, {
        examples: [
          {
            id: "additive",
            label: "🟢 Additive",
            ask: "Add a docs page under docs/ showing how to run audit in CI with a sample workflow snippet. Don't change the CLI.",
          },
          {
            id: "behavioral",
            label: "🟡 Behavioral",
            ask: "Make audit print SARIF by default instead of the human text report. Power users can pass a flag for the old format.",
          },
          {
            id: "core",
            label: "🔴 Core",
            ask: "Move the bin from cli/main.mjs to a new package structure and add several runtime dependencies so we can ship plugins faster.",
          },
        ],
      });
    }

    if (req.method === "POST" && url.pathname === "/api/classify") {
      return handleClassify(req, res);
    }

    if (req.method === "GET") return serveStatic(req, res, url.pathname);
    send(res, 405, "Method not allowed");
  });
}

function listen(port) {
  return new Promise((resolve, reject) => {
    const server = createAppServer();
    server.once("error", reject);
    server.listen(port, HOST, () => resolve(server));
  });
}

function banner(port) {
  const url = `http://${HOST}:${port}`;
  return `
╔══════════════════════════════════════════════════════════╗
║  FORGE — Change Conductor                                ║
║  Local intake demo (not Jabuti, not DocGuard)              ║
║                                                          ║
║  →  ${url.padEnd(48)}║
║                                                          ║
║  If you still see another site, you're on the wrong port.║
║  This process owns ONLY the URL above.                   ║
╚══════════════════════════════════════════════════════════╝
`;
}

async function main() {
  const maxTries = 20;
  let lastErr;
  for (let i = 0; i < maxTries; i++) {
    const port = PREFERRED + i;
    try {
      await listen(port);
      process.stdout.write(banner(port));
      if (port !== PREFERRED) {
        process.stdout.write(
          `(Port ${PREFERRED} was busy — auto-moved to ${port}. Jabuti/others often sit on 8787.)\n`
        );
      }
      return;
    } catch (err) {
      lastErr = err;
      if (err?.code !== "EADDRINUSE") throw err;
    }
  }
  console.error(
    `Forge could not bind ports ${PREFERRED}–${PREFERRED + maxTries - 1}. Last error:`,
    lastErr
  );
  console.error("Set PORT=NNNN and retry. Do not use a port another app already owns.");
  process.exit(1);
}

main();
