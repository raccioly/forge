#!/usr/bin/env node
/**
 * Tiny local Forge intake demo.
 * Zero dependencies. Serves UI + POST /api/classify.
 *
 * Usage (from repo root): node demo/server.mjs
 * Open http://127.0.0.1:8787
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
const PORT = Number(process.env.PORT || 8787);
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
    title: "Human review brief (Core — no implementation PR)",
    ask,
    classification: result.class,
    rationale: result.rationale,
    matched_protected_paths: result.matched?.protected_paths || [],
    matched_invariants: result.matched?.invariants || [],
    approvers_core: result.approvers?.core || [],
    forge_will: "Refuse to implement until Core approvers re-scope.",
    humans_should_decide: [
      "Is this truly Core, or can it be split into an Additive side package?",
      "What is the blast radius across teams that depend on these paths/invariants?",
      "Who must sign off, and what would a safer scoped plan look like?",
    ],
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
  if (!ask.trim()) {
    return sendJson(res, 400, { error: "Missing ask" });
  }

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
  });
}

function serveStatic(req, res, urlPath) {
  let rel = urlPath === "/" ? "/index.html" : urlPath;
  rel = decodeURIComponent(rel).split("?")[0];
  if (rel.includes("..")) return send(res, 400, "Bad path");
  const file = join(PUBLIC, rel);
  if (!file.startsWith(PUBLIC) || !existsSync(file)) {
    return send(res, 404, "Not found");
  }
  const type = TYPES[extname(file)] || "application/octet-stream";
  send(res, 200, readFileSync(file), type);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, product: "forge-intake-demo" });
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
          label: "Additive — new docs page",
          ask: "Add a docs page under docs/ showing how to run audit in CI with a sample workflow snippet. Don't change the CLI.",
        },
        {
          id: "behavioral",
          label: "Behavioral — change default output",
          ask: "Make audit print SARIF by default instead of the human text report. Power users can pass a flag for the old format.",
        },
        {
          id: "core",
          label: "Core — move bin + add deps",
          ask: "Move the bin from cli/main.mjs to a new package structure and add several runtime dependencies so we can ship plugins faster.",
        },
      ],
    });
  }

  if (req.method === "POST" && url.pathname === "/api/classify") {
    return handleClassify(req, res);
  }

  if (req.method === "GET") {
    return serveStatic(req, res, url.pathname);
  }

  send(res, 405, "Method not allowed");
});

server.listen(PORT, HOST, () => {
  process.stdout.write(
    `Forge intake demo → http://${HOST}:${PORT}\n(Ctrl+C to stop)\n`
  );
});
