# Local intake demo

## Run

```bash
npm run demo
```

Open http://127.0.0.1:8787

## What it does

1. Paste employee-style feedback
2. Optionally paste/load a target `core.yaml`
3. Classify → Additive / Behavioral / Core
4. If Core, show a **human review brief** stub (Forge still refuses to implement)

## What it is not

Not the employee portal. No login, no org catalog, no GitHub writes, no merge.

## API (local)

- `GET /api/health`
- `GET /api/examples`
- `GET /api/example-core`
- `POST /api/classify` body: `{ "ask": "...", "core_yaml": "..." }`
