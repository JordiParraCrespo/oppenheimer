---
"@oppenheimer/env": minor
"@oppenheimer/api": minor
"@oppenheimer/mcp": minor
"@oppenheimer/web": patch
"@oppenheimer/mobile": patch
---

One `.env` at the repo root, documented by a root `.env.example`.

New `@oppenheimer/env` package locates the workspace root (walking up to
`pnpm-workspace.yaml` or a `package.json` with `workspaces`), loads `.env`
then `.env.local` (local wins between the files), and never overwrites a
value already in `process.env` — real environment variables always win, so
the same loader is correct in CI and in production containers.

- `apps/api` entry points (`main.ts`, TypeORM CLI `data-source.ts`, seed,
  OpenAPI generation, `auth.ts`) import `@oppenheimer/env/load` instead of
  `dotenv/config`, which resolved `.env` against `process.cwd()`. The TypeORM
  CLI previously loaded no env file at all.
- `apps/web` reads the root file via Vite's `envDir`; a `.env` inside the app
  directory is no longer read.
- `apps/mobile` loads the root file in `app.config.ts` before Metro bundles,
  and its deep-link `scheme` now reads `MOBILE_SCHEME` — the same variable the
  API uses for its trusted origin — instead of a hardcoded copy.
- `apps/mcp` entry points load the root file too (a no-op outside a
  workspace), and the HTTP port now prefers `MCP_PORT` over `PORT` so a shared
  root `.env` can't make it collide with the API.
- Stale variables removed: the `JWT_SECRET` fallback for `BETTER_AUTH_SECRET`
  and `JWT_REFRESH_SECRET` / `NEXT_PUBLIC_API_URL` in
  `docker/docker-compose.prod.yml` (which now passes `BETTER_AUTH_SECRET` /
  `BETTER_AUTH_URL`); `SENTRY_DSN` / `EXPO_PUBLIC_SENTRY_DSN` were documented
  but never read and are not carried over.

The three per-app `.env.example` files are replaced by a single root
`.env.example` documenting every variable the repo reads.
