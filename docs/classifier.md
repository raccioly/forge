# forge-classify

Rule-based v0 classifier. No LLM. Zero dependencies.

## Usage

```bash
npm test
node cli/forge-classify.mjs --ask "..." --core examples/core.example.yaml
node cli/forge-classify.mjs --json --ask "..." --core path/to/core.yaml
```

## Output

- `class`: Additive | Behavioral | Core
- `rationale`: why
- `allowed_next_step`: what Forge may do next
- `approvers`: from core.yaml when provided

## Decision order

1. Protected paths / invariants from `core.yaml` → Core
2. Behavioral signals (defaults, replace existing, migrate) → Behavioral
3. Additive signals (new docs/examples/optional flags) → Additive
4. Unclear or missing `core.yaml` → Behavioral (safe default)

Fixtures: the three asks in `examples/classified-asks.md` are covered by `tests/classify.test.mjs`.
