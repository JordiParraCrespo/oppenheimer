# oppenheimer

A terminal and VM orchestrator you log in to from anywhere. Open a
browser, pick a machine you own or a fresh VM, get a terminal that
survives everything, type `claude` or `codex`, run thirty of them.

The MVP is Orca on the web without VMs: connect a host you own, run
sessions on it as worktrees with a tmux terminal, Claude Code first.
Workspaces are personal for now; teams come later on the same users
table. See [`product/versions/mvp/00-scope.md`](product/versions/mvp/00-scope.md).

- [`product/`](product/README.md): the research notes and the plan, in the
  order they were decided.
- [`product/brief.html`](product/brief.html): the one-page brief.

The codebase started from the Flama full-stack monorepo. Every app below
is optional except the API and can be removed later with the starter
tooling (see [Trimming the monorepo](#trimming-the-monorepo)).

## What's included

### The MVP

| App           | Description                                                                            |
| ------------- | -------------------------------------------------------------------------------------- |
| `apps/api`    | NestJS control plane — identity, hosts, sessions, relay, GitHub App tokens (Domain-Driven Hexagon, DB-backed RBAC, queues, caching, storage, email) |
| `apps/web`    | The console — Vite + TanStack Router SPA: sessions, New session, hosts, settings       |
| `apps/runner` | The Go host agent — worktrees, tmux, PTY stream, outbound connection to the control plane |
| `apps/docs`   | Docusaurus — architecture and error catalog                                            |
| `e2e`         | Playwright suites against the running API and web app                                  |

Start these with `pnpm dev:mvp`.

### Kept for later slices

Carried from the starter so the slice that needs them starts with them in
place. Nothing in the MVP builds on them.

| App                    | Description                                                              |
| ----------------------- | -------------------------------------------------------------------------- |
| `apps/admin-web`         | Admin control plane (web) — users, roles and permissions                 |
| `apps/admin-mobile`      | Admin control plane (Expo) — users and roles                             |
| `apps/mobile`            | Consumer Expo app — NativeWind, i18next, SecureStore                     |
| `apps/cli`               | `oppenheimer` command-line interface — commander, scoped API tokens            |
| `apps/mcp`               | MCP server — stdio + Streamable HTTP, scope-filtered tools                |
| `apps/web-showcase`      | Next.js showcase for the web design system                                |
| `apps/mobile-showcase`   | Expo showcase for the mobile design system                                |
| `qa`                     | Scenario-driven Playwright QA pack with maturity tracking and screenshots |
| `helm`                   | Kubernetes chart for the Tier 2 deployment                               |

### Packages

| Package                          | Description                                                        |
| --------------------------------- | -------------------------------------------------------------------- |
| `packages/shared`                 | Zod schemas, types, CASL permissions, scope catalog                |
| `packages/auth`                   | Shared Better Auth config — user fields, plugins, client helpers   |
| `packages/env`                    | Root `.env` loader shared by the Node apps                         |
| `packages/frontend/core`          | Kernel every app loads: session, users, user settings, capabilities, analytics, InversifyJS DI |
| `packages/frontend/consumer`      | Consumer product domain: organizations, profile, api-tokens        |
| `packages/frontend/admin`         | Control-plane domain: admin-users, roles                           |
| `packages/frontend/web`           | What both Vite apps share below their routes, by concern           |
| `packages/frontend/mobile`        | What both Expo apps share below their routes                       |
| `packages/backend/*`              | Cross-cutting NestJS toolkit: errors/filters (`core`), DDD building blocks (`ddd`), authorization kernel (`authz`), Redis cache (`cache`), queues (`queue`), file storage (`storage`), email (`email`), i18n (`i18n`) |
| `packages/go/*`                   | Cross-cutting Go toolkit for `apps/runner`: `core`, `config`, `httpx`, `auth`, `health`, `ws`, `postgres` |
| `packages/frontend/design-system/web`      | shadcn/ui + Base UI + Tailwind v4 components                       |
| `packages/frontend/design-system/mobile`   | NativeWind + rn-primitives React Native components                 |
| `packages/frontend/api-client`    | Auto-generated typed client from Swagger                           |
| `packages/translations`           | Shared i18n (en/es)                                                |
| `packages/tsconfig`               | Shared TypeScript configs                                          |
| `packages/frontend/nitro-app-info`         | Nitro native module (Swift/Kotlin) exposing native app info to the mobile apps |

## Quick start

```bash
# Install dependencies
pnpm install

# Start infrastructure (Postgres + Redis)
pnpm docker:dev

# Copy the environment file (one .env at the repo root serves every app)
cp .env.example .env

# Start the MVP: api + web + runner (pnpm dev starts every app)
pnpm dev:mvp
```

<!-- oppenheimer:begin starter -->
## Trimming the monorepo

Every app ships from day one so nothing has to be ported later; an app that
turns out unnecessary can still go. Ask your coding agent (the `/starter-init`
skill): it proposes which apps and tools to keep, then removes the rest with
`scripts/starter/prune.mjs` and rewrites the docs so no dead reference
survives. Without an agent:

```bash
pnpm starter:prune --list                       # what can go
pnpm starter:prune --without mobile,runner,mcp  # remove some, refresh the lockfile
```

Every optional app is a feature in `scripts/starter/features.json`, and every
file that mentions one wraps those lines in `oppenheimer:begin`/`oppenheimer:end` markers.
`pnpm starter:check` (run in CI) fails when a reference escapes them.
<!-- oppenheimer:end starter -->

## Services

| App                | URL                            |
| ------------------ | ------------------------------ |
| Web                | http://localhost:3000          |
| Admin Web          | http://localhost:3003          |
| API                | http://localhost:3001          |
| API Docs (Swagger) | http://localhost:3001/api/docs |
| Docs               | http://localhost:3002          |

## Tech stack

- **Monorepo**: Turborepo + pnpm
- **Backend**: NestJS (Domain-Driven Hexagon architecture), TypeORM, PostgreSQL, Redis, BullMQ
- **Go service template**: `apps/runner` — `net/http`, API keys, the same hexagon layering as the API
- **Web**: Vite + TanStack Router, Tailwind v4, shadcn/ui
- **Mobile**: Expo, NativeWind + rn-primitives
- **Auth**: Better Auth (email/password + Google + GitHub), cookie sessions, Expo plugin for mobile
- **Authorization**: Database-backed RBAC — roles and permissions managed through the API, enforced with CASL
- **CLI & MCP access**: shared scope catalog — a credential's effective access is the intersection of its scopes and the user's roles
- **Validation**: Zod
- **State**: Zustand + TanStack Query
- **DI**: InversifyJS (frontend), NestJS (backend)
- **Testing**: Vitest, Testcontainers, Playwright (`e2e`, `qa`)
- **Linting/formatting**: Biome, plus a design-system usage linter (oxlint) for `apps/web`, `apps/admin-web` and the mobile apps
- **CI/CD**: GitHub Actions — a pull request runs only the packages its diff affects, with a full run on `main`
- **Deployment**: Docker, Helm (K8s)

## Scripts

```bash
pnpm dev:mvp             # Start the MVP loop: api, web, runner
pnpm dev                 # Start every app
pnpm build                # Build all apps and packages
pnpm test                 # Run unit tests
pnpm test:integration     # Run integration tests
pnpm test:e2e             # Run the Playwright e2e suite
pnpm qa:suite             # Run the QA scenario pack
pnpm lint                 # Lint all code
pnpm arch                 # Check architecture boundaries (apps/api and the frontend, via dependency-cruiser)
pnpm check                # Biome check + fix
pnpm docker:dev           # Start dev infrastructure
pnpm docker:dev:down      # Stop dev infrastructure
pnpm docker:prod          # Start production stack
pnpm changeset            # Create a changeset
pnpm generate:api-client  # Regenerate API client from Swagger
```

## License

MIT
