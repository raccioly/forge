# Forge change policy

Every request is **classified before planning**. Classification decides whether Forge may implement, must wait for an approver, or must refuse and hand a brief to humans.

## Change classes

### 1. Additive

**Meaning:** New capability that does not alter how existing features behave today.

Examples:
- New optional CLI flag with default off
- New docs page, example, or template
- New endpoint behind a feature flag that existing clients never hit

**Forge may:** clarify → plan → implement on a branch → open a PR.

**Forge must not:** change defaults, output contracts, or paths that existing users already depend on and call that “additive.”

### 2. Behavioral

**Meaning:** Changes how an existing feature works — outputs, defaults, exit codes, UX of flows people already use, public API shape.

Examples:
- Changing JSON field names in an existing report
- Flipping a default from off to on
- Reworking an existing screen’s primary action

**Forge may:** clarify hard, list assumptions, draft a plan and a PR **only after** a named Behavioral approver (from the target’s `core.yaml`) explicitly says go.

**Forge must not:** ship Behavioral work on Additive rules, or treat “the requester is senior” as approval unless they are listed.

### 3. Core

**Meaning:** Touches **protected paths** or **invariants** declared in the target’s `core.yaml` (auth, tenancy, shared data model, billing, cross-team contracts, CLI entrypoints, published package contracts, etc.).

Examples:
- Editing the target’s main binary entrypoint contract
- Changing shared schema used by multiple teams
- Weakening an invariant such as “zero unexpected runtime deps”

**Forge must:** refuse to implement. Open a short **human review brief** (ask, blast radius, affected invariants/paths, options). No code branch for Core unless a Core approver later reclassifies the work and authorizes a scoped plan.

## How “core” is defined

**Not vibes.** Owners of each target app check in a thin `core.yaml` (see [`schemas/core.schema.json`](../schemas/core.schema.json)).

Forge reads that file when classifying. If the file is **missing**, Forge treats the whole target as **Behavioral** (no silent auto-ship of risky changes; always require an approver before code).

Approvers are per target:

```yaml
approvers:
  behavioral: [owner-handle]
  core: [owner-handle, architect-handle]
```

## Decision order

1. Does the ask touch a `protected_paths` entry or break an `invariants` entry? → **Core**
2. Else, does it change existing behavior/contracts/defaults? → **Behavioral**
3. Else, is it clearly additive / flag-gated / docs-examples only? → **Additive**
4. If unclear → ask one clarifying question; default to **Behavioral** until proven Additive

## Non-negotiables

- PR-only. Never merge. Never commit to the default branch.
- Push back on vague, unsafe, or out-of-scope asks.
- User-facing UI: visuals/wireframe approval before implementation.
- No secrets in commits. No employer/client brand names in public artifacts unless the repo owner explicitly allows it.
