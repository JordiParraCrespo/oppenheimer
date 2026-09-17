# @oppenheimer/web

The console: sign-up and sign-in, the sessions list and New session, the
profile, and the workspace settings (general, hosts, security, API tokens). Platform administration is a different app,
[`apps/admin-web`](../admin-web).

## Stack

- Vite SPA, built to static assets and served by nginx in Docker
- TanStack Router (file routes in `src/routes/`, tree generated into
  `src/routeTree.gen.ts`) and TanStack Query, persisted to `localStorage`
- Tailwind CSS v4 with `@oppenheimer/design-system-web`
- react-i18next over `@oppenheimer/translations`; only the default locale is bundled
- React Hook Form with `zodResolver` over schemas from `@oppenheimer/shared`
- Better Auth browser client (cookie session) via `@oppenheimer/auth`

## Run it

Configuration comes from the **root `.env`** — `envDir` in `vite.config.ts`
points at the repo root, and a `.env` in this directory is deliberately not
read. The dev server proxies `/api` to the API, so the session cookie stays
same-origin; set `VITE_API_URL` only when the API is on another origin.

```bash
pnpm docker:dev                     # Postgres + Redis
pnpm --filter @oppenheimer/api dev        # the API this app talks to
pnpm --filter @oppenheimer/web dev        # http://localhost:3000
pnpm --filter @oppenheimer/web build      # tsc -b && vite build
pnpm --filter @oppenheimer/web preview
pnpm --filter @oppenheimer/web test       # Vitest
pnpm --filter @oppenheimer/web lint
pnpm --filter @oppenheimer/web arch       # dependency-cruiser
pnpm --filter @oppenheimer/e2e e2e:web    # Playwright, against a live API
```

## Layout

```
src/
├── main.tsx, app.tsx     # bootstrap, router, the single <Toaster />
├── routes/               # Route + a mount, under 120 lines each
├── features/             # <module>/{screens,sections,dialogs,forms,components,hooks,lib,__tests__}
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
  `useTableQuery`, `useZodResolver`, `dateFormatter` — are in
  `@oppenheimer/frontend-web` (`packages/frontend/web`).
- Primitives are in `@oppenheimer/design-system-web`.
- Domain logic is in `@oppenheimer/frontend-core` (session, users, user settings,
  capabilities, analytics) and `@oppenheimer/frontend-consumer` (sessions,
  hosts, and the account chrome: organizations, profile, api-tokens). This app
  loads the consumer product and never the admin one.

## More

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the layers, the kind table, the
  route contract, the render rules, what the checkers enforce.
- [`AGENTS.md`](./AGENTS.md) — the short version for agents.
