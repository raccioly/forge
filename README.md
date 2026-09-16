# Forge

**Change Conductor** — the company’s change front door.

Today, an employee idea often means: open a Jira ticket → someone triages → product owner pushes back → analysis → maybe a prototype → someone codes → someone merges. Forge collapses the theater without removing the brakes.

## What it does

1. Someone picks an application and submits feedback (chat, form, or later: a web portal).
2. Forge **clarifies** the ask and **classifies** it before any code:
   - **Additive** — new capability that does not change how existing features work
   - **Behavioral** — changes how something already works
   - **Core** — touches protected surfaces declared by the target app
3. Forge plans a small, reversible change, runs a UI/visuals gate when needed, implements on a **branch**, and opens a **PR**.
4. Humans review. Forge **never merges** and **never commits to the default branch**.

## What lives here vs elsewhere

| Piece | Where |
| --- | --- |
| Change-class policy, `core.yaml` schema, agent operating rules | **This repo (Forge)** |
| Optional thin `core.yaml` naming protected paths/invariants | **Each target app** (when onboarded) |
| DocGuard, websec-validator, internal portals, etc. | **Targets** — not forks of Forge |

DocGuard and other shipping products stay untouched until you explicitly onboard them as targets.

## Docs in this repo

- [`docs/change-policy.md`](docs/change-policy.md) — Additive / Behavioral / Core gates
- [`schemas/core.schema.json`](schemas/core.schema.json) — schema for a target’s `core.yaml`
- [`examples/core.example.yaml`](examples/core.example.yaml) — illustrative target config (not a real product change)
- [`examples/classified-asks.md`](examples/classified-asks.md) — three sample tickets showing the brake
- [`AGENTS.md`](AGENTS.md) — rules for any agent running Forge

## Status

v0 is policy and schema only. Employee login portal, org-wide GitHub project catalog, and SSO come later.

## License

MIT (see `LICENSE` when present).
