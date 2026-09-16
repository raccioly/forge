# Local intake demo

## Run

```bash
npm run demo
```

Watch the terminal. Forge prints a **FORGE** banner with the exact URL (default `http://127.0.0.1:3847`). If the port is busy, it auto-moves to the next free port.

**Do not assume port 8787** — other local apps (e.g. Jabuti) may already own it. If the page title is not `FORGE — Change Conductor`, you are on the wrong server.

## What it does

1. Paste a mission ask
2. Optionally load/paste target `core.yaml`
3. Run conductor → Additive / Behavioral / Core
4. Compare old ticket-path vs Forge path
5. Core → **LAUNCH ABORT** brief (no implementation PR)

## What it is not

Not the employee portal. No login, no org catalog, no GitHub writes, no merge, no contest publish.

## API (local)

- `GET /api/health` → `{ product: "forge", ... }`
- `GET /api/examples`
- `GET /api/example-core`
- `POST /api/classify` body: `{ "ask": "...", "core_yaml": "..." }`
