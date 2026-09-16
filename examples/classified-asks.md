# Classified ask examples

Three fictional tickets against the illustrative target in `core.example.yaml`. Use these to gut-check whether Forge’s brakes match how you’d run a company.

---

## 1. Additive — new example cookbook page

**Ask:** “Add a docs page under `docs/` showing how to run audit in CI with a sample workflow snippet. Don’t change the CLI.”

**Classification:** **Additive**

**Why:** Lives under an `additive_hints` path; does not touch protected paths; does not change defaults, exit codes, or published contracts.

**Forge does:** Clarify success criteria → thin plan → branch → PR with the new page only.

**Forge refuses:** Expanding the PR into “while we’re here, change the default audit severity.”

---

## 2. Behavioral — change default output format

**Ask:** “Make `audit` print SARIF by default instead of the human text report. Power users can pass a flag for the old format.”

**Classification:** **Behavioral**

**Why:** Changes default behavior of an existing command that people already script against. Not necessarily Core unless the work edits a protected path/invariant — but it is still Behavioral and needs an approver before code.

**Forge does:** Push back with blast radius (CI jobs, agent prompts, docs). List assumptions. Wait for a `approvers.behavioral` go. Then PR that includes migration notes and ideally a compatibility window.

**Forge refuses:** Implementing on Additive rules because “it’s just a default.”

---

## 3. Core — rewrite CLI entrypoint / weaken an invariant

**Ask:** “Move the bin from `cli/main.mjs` to a new package structure and add several runtime dependencies so we can ship plugins faster.”

**Classification:** **Core**

**Why:** Touches `protected_paths` (`cli/main.mjs`, `package.json`) and threatens invariants (`cli-bin-stable`, `zero-deps-runtime`).

**Forge does:** Refuse to implement. Open a human review brief: ask, affected paths/invariants, options (plugin host as Additive side package vs breaking the published contract), who must decide (`approvers.core`).

**Forge refuses:** Opening an implementation PR “to save time” before Core approvers re-scope the work.
