# @oppenheimer/env

Loader for the monorepo's single root `.env`. There is **one `.env`, at the
root of the repo**, and the root `.env.example` is its documentation — never
add a per-package `.env`.

## What it does

`loadEnv()`:

1. Locates the workspace root by walking up from `cwd` until it finds a
   `pnpm-workspace.yaml` (or a `package.json` declaring `workspaces`).
2. Reads `<root>/.env`, then `<root>/.env.local` on top of it (`.env.local`
   wins between the files — note that `vercel env pull` writes `.env.local`).
3. Writes the merged values into `process.env`, **never overwriting a value
   that is already set** — real environment variables always win, which is what
   makes the same loader correct in CI and in production containers.

Outside any workspace (e.g. an installed CLI binary run from an arbitrary
directory) it is a silent no-op.

## Usage

Side-effect import, as the first import of an entrypoint (the `dotenv/config`
replacement):

```ts
import "@oppenheimer/env/load";
```

Or explicitly:

```ts
import { loadEnv } from "@oppenheimer/env";

const { root, loaded, applied } = loadEnv();
```

## Who uses it

- `apps/api` — every entrypoint (`main.ts`, TypeORM CLI `data-source.ts`,
  `database/seed.ts`, `generate-openapi.ts`) and `auth/infrastructure/better-auth.config.ts` load it first.
- `apps/mobile`, `apps/admin-mobile` — each app's `app.config.ts` calls it so
  Expo/Metro inline `EXPO_PUBLIC_*` values from the root `.env`.
- `apps/mcp` — both entrypoints load it (a no-op when the server is installed
  outside the repo).
- `apps/web` does **not** need it: `vite.config.ts` points `envDir` at the
  workspace root, so Vite reads the root `.env` itself.
