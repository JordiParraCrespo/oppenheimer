---
"@oppenheimer/env": minor
---

One `.env` at the repo root, documented by a root `.env.example`.

New package: it locates the workspace root (walking up to `pnpm-workspace.yaml`
or a `package.json` with `workspaces`), loads `.env` then `.env.local` (local
wins between the files), and never overwrites a value already in `process.env`
— real environment variables always win, so the same loader is correct in CI
and in production containers.

The three per-app `.env.example` files are replaced by a single root
`.env.example` documenting every variable the repo reads. Stale variables are
removed: the `JWT_SECRET` fallback for `BETTER_AUTH_SECRET`, and
`JWT_REFRESH_SECRET` / `NEXT_PUBLIC_API_URL` in
`docker/docker-compose.prod.yml` (which now passes `BETTER_AUTH_SECRET` /
`BETTER_AUTH_URL`). `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` were documented but
never read and are not carried over.
