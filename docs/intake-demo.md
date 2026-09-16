# Local intake demo

## Run

```bash
cd /Users/ricardoaccioly/Repo_claude/forge   # or your clone path
npm run demo
```

Use the URL printed in the terminal (default `http://127.0.0.1:3847`).

## Flow (repo-first)

1. **Bind a GitHub target** (`owner/repo` or a preset chip)
2. Forge loads `core.yaml` / `forge/core.yaml` / `.forge/core.yaml` if present
3. Submit feedback → Additive / Behavioral / Core for **that** target
4. Core → LAUNCH ABORT brief (no implementation PR)

If the repo has no `core.yaml`, Forge uses a Behavioral-safe default until owners onboard protected surfaces.

## API

- `POST /api/bind` `{ "repo": "owner/name" }`
- `POST /api/classify` `{ "ask", "target", "core_yaml" }`
- `GET /api/presets`
