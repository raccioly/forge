#!/usr/bin/env node
/**
 * Forge local intake — Change Conductor demo
 * Zero dependencies. Repo-first: bind target → classify.
 *
 *   npm run demo
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { classify } from "../cli/classify.mjs";
import { parseCoreYaml } from "../cli/parse-core.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC = join(__dirname, "public");
const PREFERRED = Number(process.env.PORT || 3847);
const HOST = process.env.HOST || "127.0.0.1";

const CORE_PATHS = [
  "core.yaml",
  "forge/core.yaml",
  ".forge/core.yaml",
  "examples/core.example.yaml", // Forge repo demo stand-in
];

const PRESETS = [
  {
    id: "raccioly/forge",
    owner: "raccioly",
    repo: "forge",
    label: "raccioly/forge (this product)",
    note: "Uses examples/core.example.yaml as stand-in target rules",
  },
  {
    id: "raccioly/docguard",
    owner: "raccioly",
    repo: "docguard",
    label: "raccioly/docguard",
    note: "Likely no core.yaml yet → Behavioral until onboarded",
  },
  {
    id: "raccioly/websec-validator",
    owner: "raccioly",
    repo: "websec-validator",
    label: "raccioly/websec-validator",
    note: "Likely no core.yaml yet → Behavioral until onboarded",
  },
  {
    id: "raccioly/agent-reliability-index",
    owner: "raccioly",
    repo: "agent-reliability-index",
    label: "raccioly/agent-reliability-index",
    note: "Likely no core.yaml yet → Behavioral until onboarded",
  },
];

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

function githubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

async function fetchText(url, token) {
  const headers = {
    "User-Agent": "forge-change-conductor",
    Accept: "application/vnd.github.raw+json, text/plain, */*",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const err = new Error(`Fetch failed ${res.status} for ${url}`);
    err.status = res.status;
    throw err;
  }
  return res.text();
}

async function resolveDefaultBranch(owner, repo, token) {
  const api = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = {
    "User-Agent": "forge-change-conductor",
    Accept: "application/vnd.github+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(api, { headers });
  if (res.status === 404) {
    const err = new Error(`Repo not found: ${owner}/${repo}`);
    err.status = 404;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`GitHub API ${res.status} for ${owner}/${repo}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return {
    default_branch: data.default_branch || "main",
    private: Boolean(data.private),
    description: data.description || "",
    html_url: data.html_url,
  };
}

async function loadCoreYaml(owner, repo, ref, token) {
  // Prefer Contents API (works with token for private); fall back to raw for public
  for (const path of CORE_PATHS) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
    try {
      const text = await fetchText(apiUrl, token);
      if (text != null && text.trim()) {
        return { path, text, source: "github" };
      }
    } catch (err) {
      if (err.status && err.status !== 404) {
        // keep trying other paths on 404 only; on 401/403 try raw if public
        if (err.status === 401 || err.status === 403) break;
      }
    }
  }

  for (const path of CORE_PATHS) {
    const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
    try {
      const text = await fetchText(raw, null);
      if (text != null && text.trim()) {
        return { path, text, source: "raw" };
      }
    } catch {
      /* try next */
    }
  }

  // Local stand-in when targeting this Forge checkout itself
  if (owner === "raccioly" && repo === "forge") {
    const local = join(ROOT, "examples", "core.example.yaml");
    if (existsSync(local)) {
      return {
        path: "examples/core.example.yaml",
        text: readFileSync(local, "utf8"),
        source: "local-demo",
      };
    }
  }

  return null;
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

function parseOwnerRepo(input) {
  const raw = String(input || "").trim().replace(/^https?:\/\/github\.com\//i, "");
  const cleaned = raw.replace(/\.git$/i, "").replace(/\/$/, "");
  const parts = cleaned.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return { owner: parts[0], repo: parts[1] };
}

async function handleBind(req, res) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }

  const parsed = parseOwnerRepo(payload.repo || payload.target || "");
  if (!parsed) {
    return sendJson(res, 400, {
      error: "Provide repo as owner/name (e.g. raccioly/docguard)",
    });
  }

  const token = githubToken();
  let meta;
  try {
    meta = await resolveDefaultBranch(parsed.owner, parsed.repo, token);
  } catch (err) {
    const status = err.status === 404 ? 404 : 502;
    return sendJson(res, status, {
      error: err.message || "Could not resolve repo",
      hint:
        meta?.private || err.status === 401 || err.status === 403
          ? "Private repo? Set GITHUB_TOKEN or run gh auth login."
          : undefined,
    });
  }

  const ref = (payload.ref || meta.default_branch || "main").trim();
  const loaded = await loadCoreYaml(parsed.owner, parsed.repo, ref, token);

  let core = null;
  let core_parse_error = null;
  if (loaded?.text) {
    try {
      core = parseCoreYaml(loaded.text);
    } catch (err) {
      core_parse_error = String(err?.message || err);
    }
  }

  return sendJson(res, 200, {
    product: "forge",
    target: {
      owner: parsed.owner,
      repo: parsed.repo,
      full_name: `${parsed.owner}/${parsed.repo}`,
      ref,
      default_branch: meta.default_branch,
      private: meta.private,
      description: meta.description,
      html_url: meta.html_url,
    },
    core_yaml: loaded
      ? {
          found: true,
          path: loaded.path,
          source: loaded.source,
          text: loaded.text,
          parse_error: core_parse_error,
          product: core?.product || null,
          protected_path_count: core?.protected_paths?.length || 0,
          invariant_count: core?.invariants?.length || 0,
        }
      : {
          found: false,
          path: null,
          source: null,
          text: "",
          mode: "Behavioral-default",
          message:
            "No core.yaml in this repo yet. Forge will treat asks as Behavioral until owners add protected surfaces.",
        },
  });
}

async function handleClassify(req, res) {
  let payload;
  try {
    payload = JSON.parse((await readBody(req)) || "{}");
  } catch {
    return sendJson(res, 400, { error: "Invalid JSON body" });
  }

  const ask = typeof payload.ask === "string" ? payload.ask : "";
  if (!ask.trim()) return sendJson(res, 400, { error: "Missing ask" });

  const targetName =
    typeof payload.target === "string"
      ? payload.target
      : payload.target?.full_name || null;

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
    target: targetName,
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
        repo_first: true,
      });
    }

    if (req.method === "GET" && url.pathname === "/api/presets") {
      return sendJson(res, 200, { presets: PRESETS });
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

    if (req.method === "POST" && url.pathname === "/api/bind") {
      return handleBind(req, res);
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
║  Repo-first intake demo                                  ║
║                                                          ║
║  →  ${url.padEnd(48)}║
║                                                          ║
║  Pick a GitHub repo first, then submit feedback.         ║
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
          `(Port ${PREFERRED} was busy — auto-moved to ${port}.)\n`
        );
      }
      return;
    } catch (err) {
      lastErr = err;
      if (err?.code !== "EADDRINUSE") throw err;
    }
  }
  console.error(`Forge could not bind ports ${PREFERRED}–${PREFERRED + maxTries - 1}.`, lastErr);
  process.exit(1);
}

main();
