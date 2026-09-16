# Forge

**Change Conductor** — the company's change front door.

Today, an employee idea often means: open a Jira ticket → someone triages → product owner pushes back → analysis → maybe a prototype → someone codes → someone merges. Forge collapses the theater without removing the brakes.

## What it does

1. Someone picks an application and submits feedback (chat, form, or later: a web portal).
2. Forge **clarifies** the ask and **classifies** it before any code:
   - **Additive** — new capability that does not change how existing features work
   - **Behavioral** — changes how something already works
   - **Core** — touches protected surfaces declared by the target app
3. Forge plans a small, reversible change, runs a UI/visuals gate when needed, implements on a **branch**, and opens a **PR**.
4. Humans review. Forge **never merges** and **never commits to the default branch**.

## Classify (v0)

Rule-based brake you can run locally (Node 18+, zero dependencies):

```bash
npm test
node cli/forge-classify.mjs --ask "Add a docs page under docs/. Don't change the CLI." --core examples/core.example.yaml
node cli/forge-classify.mjs --json --ask "Make audit print SARIF by default" --core examples/core.example.yaml
```

Output: `class`, `rationale`, `allowed_next_step` (and approvers when `core.yaml` is present).

## What lives here vs elsewhere

| Piece | Where |
| --- | --- |
| Change-class policy, `core.yaml` schema, classifier, agent rules | **This repo (Forge)** |
| Optional thin `core.yaml` naming protected paths/invariants | **Each target app** (when onboarded) |
| DocGuard, websec-validator, internal portals, etc. | **Targets** — not forks of Forge |

DocGuard and other shipping products stay untouched until you explicitly onboard them as targets.

## Docs in this repo

- [`docs/change-policy.md`](docs/change-policy.md) — Additive / Behavioral / Core gates
- [`schemas/core.schema.json`](schemas/core.schema.json) — schema for a target's `core.yaml`
- [`examples/core.example.yaml`](examples/core.example.yaml) — illustrative target config (not a real product change)
- [`examples/classified-asks.md`](examples/classified-asks.md) — three sample tickets showing the brake
- [`AGENTS.md`](AGENTS.md) — rules for any agent running Forge
- [`cli/`](cli/) — `forge-classify` implementation

## Local intake demo

Zero-dependency local UI (uses the classifier):

```bash
npm run demo
# open http://127.0.0.1:8787
```

Paste feedback, optionally load the example `core.yaml`, hit Classify. Core asks show a human-review brief stub (no implementation PR).

## Status

v0 = policy + schema + classifier + **local intake demo**. Employee login portal, org-wide GitHub project catalog, and SSO come later.

## License

MIT (see `LICENSE` when present).
