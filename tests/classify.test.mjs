import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { classify } from "../cli/classify.mjs";
import { parseCoreYaml } from "../cli/parse-core.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const coreText = readFileSync(join(root, "examples/core.example.yaml"), "utf8");
const core = parseCoreYaml(coreText);

test("parseCoreYaml reads protected paths and approvers", () => {
  assert.equal(core.product, "example-docs-cli");
  assert.ok(core.protected_paths.some((p) => p.path === "cli/main.mjs"));
  assert.deepEqual(core.approvers.behavioral, ["raccioly"]);
  assert.ok(core.additive_hints[0]?.paths?.includes("docs/**"));
});

test("example 1 → Additive", () => {
  const ask =
    "Add a docs page under docs/ showing how to run audit in CI with a sample workflow snippet. Don't change the CLI.";
  const r = classify(ask, core);
  assert.equal(r.class, "Additive");
  assert.match(r.allowed_next_step, /PR/i);
});

test("example 2 → Behavioral", () => {
  const ask =
    "Make audit print SARIF by default instead of the human text report. Power users can pass a flag for the old format.";
  const r = classify(ask, core);
  assert.equal(r.class, "Behavioral");
  assert.match(r.allowed_next_step, /approver/i);
});

test("example 3 → Core", () => {
  const ask =
    "Move the bin from cli/main.mjs to a new package structure and add several runtime dependencies so we can ship plugins faster.";
  const r = classify(ask, core);
  assert.equal(r.class, "Core");
  assert.match(r.allowed_next_step, /Refuse/i);
  assert.ok(r.matched.protected_paths.includes("cli/main.mjs"));
});

test("missing core.yaml defaults to Behavioral", () => {
  const r = classify("Please improve something vaguely", null);
  assert.equal(r.class, "Behavioral");
  assert.equal(r.core_present, false);
});
