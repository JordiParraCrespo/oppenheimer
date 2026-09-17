# @oppenheimer/admin-web

The browser control plane. It manages platform users — creating them, banning
and unbanning, setting passwords, revoking sessions, assigning application
roles — and the roles themselves with their permission grants. Consumer
features belong in [`apps/web`](../web); this app has no registration route and
no workspace of its own.

Access is gated twice: the API restricts control-plane endpoints, and
`src/routes/_authenticated.tsx` renders an access-denied alert unless the
signed-in profile reports `canAccessControlPlane`.

## Stack

- Vite SPA, built to static assets and served by nginx in Docker
- TanStack Router (file routes in `src/routes/`, tree generated into
  `src/routeTree.gen.ts`) and TanStack Query, persisted to `localStorage`
- Tailwind CSS v4 with `@oppenheimer/design-system-web`
- react-i18next over `@oppenheimer/translations`
- React Hook Form with `zodResolver` over schemas from `@oppenheimer/shared`
- Better Auth browser client (cookie session) via `@oppenheimer/auth`

## Run it

Configuration comes from the **root `.env`** — `envDir` in `vite.config.ts`
points at the repo root, and a `.env` in this directory is deliberately not
read. Set `ADMIN_FRONTEND_URL` to the public origin in deployed environments.

```bash
pnpm docker:dev                          # Postgres + Redis
pnpm --filter @oppenheimer/api dev             # the API this app talks to
pnpm --filter @oppenheimer/admin-web dev       # http://localhost:3003
pnpm --filter @oppenheimer/admin-web build     # tsc -b && vite build
pnpm --filter @oppenheimer/admin-web preview
pnpm --filter @oppenheimer/admin-web test      # Vitest
pnpm --filter @oppenheimer/admin-web lint
pnpm --filter @oppenheimer/admin-web arch      # dependency-cruiser
```

## Layout

```
src/
├── main.tsx, app.tsx     # bootstrap, router, the single <Toaster />
├── routes/               # Route + a mount, under 120 lines each
├── features/             # admin-users/, roles/, auth/ — kind directories only
├── providers/            # oppenheimer-provider.tsx, query-provider.tsx
├── lib/                  # configuration only: oppenheimer.ts, auth-client.ts, nav.ts
├── styles/
└── types/
public/
├── theme-init.js         # applies the stored theme before first paint
└── session-preload.js    # starts the session lookup before the bundle parses
```

## Where the shared code lives

- UI and browser glue both Vite apps share — `AppShell`, `DataTable`,
  `useTableQuery`, `useZodResolver`, `sanitizeRedirect` — are in
  `@oppenheimer/frontend-web` (`packages/frontend/web`), the same kit `apps/web` uses.
- Primitives are in `@oppenheimer/design-system-web`.
- Domain logic is in `@oppenheimer/frontend-core` (session, users, user settings,
  capabilities, analytics) and `@oppenheimer/frontend-admin` (admin-users, roles).
  This app loads the admin product and never the consumer one.

## More

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the layers, the kind table, the
  route contract, the render rules, what the checkers enforce.
- [`AGENTS.md`](./AGENTS.md) — the short version for agents.
