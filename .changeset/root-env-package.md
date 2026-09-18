---
"@oppenheimer/env": minor
---

New package: it locates the workspace root and loads `.env` then `.env.local`, never overwriting a value already in `process.env`, so the same loader is correct in CI and in production containers.
