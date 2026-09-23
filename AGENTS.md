# Oppenheimer — Agent Instructions

## Project overview

Oppenheimer is a browser-based terminal and VM orchestrator: connect a host
you own (later: a VM), get sessions on it, each a git worktree with a tmux
terminal running Claude Code or Codex, streamed to the browser through a
control plane. The codebase is a Turborepo + pnpm monorepo started from the
Flama full-stack starter. The MVP is `apps/api` (control plane), `apps/web`
(the console), `apps/runner` (the host agent), `apps/docs` and `e2e`; that is
what `pnpm dev:mvp` starts. The other apps (admin, mobile, CLI, MCP, the
showcases, Helm) are kept from day one so later slices need no porting, and
are not built on until their slice arrives. The starter's reference modules
(`leads`, `billing`) are on disk but not composed into the API.

## Product notes

All research and decisions live in `product/`. Start with
`product/README.md`, which lists the notes in order and records the
decisions that changed along the way.

- The MVP is Orca on the web without VMs: connect a host you own, run
  sessions on it as worktrees with a tmux terminal, Claude Code first
  (`product/versions/mvp/00-scope.md`). VMs, sleep, accounts, and Codex
  are the slices after. `product/07-mvp.md` is superseded and kept for
  history.
- In-depth MVP design lives in `product/versions/mvp/`, one document per
  area, each with decided points and open questions, and its own decision
  log in `product/versions/mvp/README.md`.
- Workspaces are personal for now: one user per workspace, no team
  management exposed. The Better Auth `organization` row is
  the personal workspace, created at sign-up with the account as its
  single owner (`apps/api/src/organizations/commands/provision-personal-workspace/`); no roster UI,
  no invitations, no teams in the console. The one organization the
  console can create is the caller's own, on `/onboarding`, which exists
  because the sign-up hook is best-effort — an account with no workspace
  cannot open any product screen. Teams come later on the same tables. The one-page auth note is `product/versions/mvp/08-auth.md`;
  `AUTHORIZATION.md` is the starter's kernel design, kept as history.
- When a decision changes, update the note that made it and add a line to
  the "decisions that changed" list in `product/README.md`. Do not
  silently rewrite history in earlier notes.
- The one-page brief `product/brief.html` is regenerated from the notes;
  keep it in sync when a note changes.
- The Go runner (`apps/runner`) is the host agent: worktrees, tmux, PTY
  streaming, the git credential helper and its own signed updates. The
  NestJS API is the control plane. Designed in
  `product/versions/mvp/02-runner.md` and `…/09-runner-install-and-update.md`;
  the wire between them is `…/01-protocol.md`.

## Monorepo structure

```
oppenheimer/
├── apps/
│   ├── api/              # NestJS REST API
│   ├── admin-mobile/     # Expo control plane for users and roles
│   ├── admin-web/        # Vite control plane for users and roles
│   ├── cli/              # `oppenheimer` command-line interface
│   ├── docs/             # Docusaurus documentation
│   ├── mcp/              # MCP server (stdio + Streamable HTTP)
│   ├── mobile/           # Consumer Expo app
│   ├── mobile-showcase/  # Expo app showcasing the mobile design system
│   ├── runner/           # The Go host agent: pairing, service install, signed self-update (+ the REST/WS service it grew from)
│   ├── web/              # Consumer Vite + TanStack Router SPA
│   └── web-showcase/     # Next.js app showcasing the web design system
├── packages/
│   ├── auth/             # Shared Better Auth config + client helpers (@oppenheimer/auth)
│   ├── backend/
│   │   ├── authz/        # Authorization kernel: grants, policies (@oppenheimer/backend-authz)
│   │   ├── cache/        # Redis cache abstraction (@oppenheimer/backend-cache)
│   │   ├── core/         # Errors, filters, pipes, interceptors (@oppenheimer/backend-core)
│   │   ├── ddd/          # DDD/hexagon building blocks (@oppenheimer/backend-ddd)
│   │   ├── email/        # Pluggable email + React Email templates (@oppenheimer/backend-email)
│   │   ├── i18n/         # Server-side translation + Intl formatting (@oppenheimer/backend-i18n)
│   │   ├── llm/          # One interface over LLM providers: OpenRouter, Together, Anthropic… (@oppenheimer/backend-llm)
│   │   ├── queue/        # BullMQ + Bull Board (@oppenheimer/backend-queue)
│   │   └── storage/      # File storage Local/S3 (@oppenheimer/backend-storage)
│   ├── tsconfig/         # Shared TypeScript configs + build helpers (@oppenheimer/tsconfig)
│   ├── env/              # Root .env loader (@oppenheimer/env)
│   ├── frontend/         # The React tier: logic split by product, glue split by platform
│   │   ├── core/         # Kernel every app loads: session, users, settings, DI (@oppenheimer/frontend-core)
│   │   ├── consumer/     # The console's domain: sessions, hosts, plus the account chrome (@oppenheimer/frontend-consumer)
│   │   ├── admin/        # The control plane's domain: admin-users, roles (@oppenheimer/frontend-admin)
│   │   ├── api-client/   # Auto-generated typed client from Swagger (@oppenheimer/api-client)
│   │   ├── web/          # What both Vite apps share: shell, auth chrome, table, i18n… (@oppenheimer/frontend-web)
│   │   ├── mobile/       # What both Expo apps share: config, storage, analytics… (@oppenheimer/frontend-mobile)
│   │   ├── design-system/
│   │   │   ├── web/      # shadcn/ui + Base UI + Tailwind v4 (@oppenheimer/design-system-web)
│   │   │   └── mobile/   # NativeWind + rn-primitives (@oppenheimer/design-system-mobile)
│   │   └── nitro-app-info/ # Nitro native module exposing app info to the Expo apps (@oppenheimer/nitro-app-info)
│   ├── go/               # Shared Go modules (@oppenheimer/go-*): core, config, httpx, auth, health, ws, postgres, selfupdate
│   ├── shared/           # Zod schemas, types, CASL permissions
│   └── translations/     # Shared i18n JSON files
├── docker/               # Docker Compose (dev + prod)
├── helm/                 # Kubernetes Helm charts
└── .github/              # GitHub Actions CI/CD
```

Each app and package has its own `README.md` covering its purpose, exports, and
usage, and an `AGENTS.md` with the rules an agent needs there. Every `CLAUDE.md`
in the repo is a symlink to the `AGENTS.md` beside it: edit the `AGENTS.md`,
never the link.

<!-- oppenheimer:begin starter -->
Every app above except `api` is optional. `scripts/starter/features.json`
lists them with the paths and marked config blocks that go with each one, and
`/starter-init` is the skill that turns the starter into a project: a short
dialog about what the user is building, a proposal of what to keep, then
`scripts/starter/prune.mjs` removes the rest and the skill rewrites the prose.
When you add a file that mentions an optional app (CI, compose, Helm,
`.env.example`, a sidebar), wrap the lines in `# oppenheimer:begin <id>` /
`# oppenheimer:end <id>`; `pnpm starter:check` fails otherwise.
<!-- oppenheimer:end starter -->

## Key conventions

### General

- Node 22 LTS, pnpm workspaces, Turborepo for task orchestration
- **One `.env`, at the repo root**; the root `.env.example` is its
  documentation (a note per variable, nothing unread in it). Never add a
  per-package `.env`. Node apps load it via `@oppenheimer/env` (real env vars always
  win); the web apps read it through Vite's `envDir`; the mobile apps load it in
  `app.config.ts`
- Biome for linting and formatting (not ESLint/Prettier). The one exception is
  the apps' design-system linter, `@shadcn/lint`, which only ships as an
  ESLint/oxlint plugin: `pnpm lint:design` runs it through oxlint with oxlint's
  own rules switched off, so it enforces design-system rules and nothing Biome
  already covers — see `.agents/rules/frontend-ui.md`
- Conventional commits enforced via commitlint
- Independent versioning per package via Changesets
- No git hooks — CI enforces quality
- CI runs what a pull request touches, not the whole pipeline:
  `scripts/ci/affected.mjs` asks Turborepo which packages the diff affects
  (a change in `packages/shared` reaches every app that imports it), and the
  jobs build, test and package only those. A push to `main`, or a change to a
  file no package owns (the workflow, the lockfile, `docker/`, `scripts/`),
  runs everything. A new Docker image is a row in that script's `IMAGES`; a
  new root-level file every package relies on is a pattern in its
  `GLOBAL_PATHS`

### Backend (`apps/api` + `packages/backend/*`)

`apps/api` follows **Domain-Driven Hexagon** architecture — see
[`apps/api/ARCHITECTURE.md`](apps/api/ARCHITECTURE.md) for the layer model, module
anatomy, the `@oppenheimer/backend-ddd` building blocks, and the "add a module"
cookbook. Use the `/scaffold-module` skill to generate a compliant module
skeleton. Boundaries are enforced by `apps/api/.dependency-cruiser.cjs`
(`pnpm arch`, run in CI and by a Claude Code Stop hook).

Detailed rules live in `.agents/rules/`, each scoped by a `paths` glob so it
loads only for the code it governs. Three are frontend:

- `frontend-architecture.md` — the placement grid (kernel, product package,
  platform kit, feature), the kind directories and what each may import, the
  render rules, and the checks that hold them
- `forms.md` — React Hook Form and Zod validation across `apps/web`,
  `apps/mobile` and the shared schemas
- `frontend-ui.md` — reaching for the design system before writing markup, the
  colour vocabulary, where helpers and route files live, placeholder data,
  translating exports, and e2e coverage

The rest are backend (scoped to `apps/api`, `packages/backend`, and—for `rbac-roles.md`—`packages/shared`):

- `nestjs-di.md` — DI import rules, `import type` restrictions, repository-port DI tokens
- `nestjs-architecture.md` — DDD vertical slices, CQRS handlers, domain layer, ports/adapters, mappers, errors, events
- `typeorm.md` — Union-typed column rules, persistence-model (ORM) conventions
- `backend-packages.md` — CJS exports, package structure (pluggable vs library), email template setup
- `api-config.md` — OAuth graceful handling, controllers, Swagger decorators, rate limiting, versioning

Errors are **RFC 7807 problem documents** (`application/problem+json`) produced by
the global `AllExceptionsFilter`; the catalog message is the stable problem
`title` and per-request specifics go in `AppError`'s `detail`. New error codes
need a row in `apps/docs/docs/errors.md` — see `nestjs-architecture.md`.

- `go.md` — the Go service template (`apps/runner`): layout, ports, errors,
  auth, what to reach for instead of a framework
- `rbac-roles.md` — database-backed roles & permissions, `@CheckPolicies`/`PoliciesGuard`, resource scoping, role-management endpoints
- `scopes-and-credentials.md` — the scope catalog, `@RequireScopes`/`ScopesGuard`, API tokens, OAuth for MCP clients

#### Authorization (roles & permissions)

Database-backed dynamic RBAC: roles and permissions live in the `role` table,
a user holds many, and routes are guarded with `@CheckPolicies`. The full
guide is `.agents/rules/rbac-roles.md`.

### CLI (`apps/cli`) and MCP server (`apps/mcp`)

Both are governed by the **scope catalog** in `packages/shared/src/scopes/`.
Roles say what a person may do; scopes say what a credential may do on their
behalf, and effective access is the intersection — see
`.agents/rules/scopes-and-credentials.md` and the "CLI & MCP" docs section.

- `apps/cli` — commander-based; commands in `src/commands/`, shared plumbing in
  `src/lib/` (config profiles, HTTP client, output, prompts). Exit codes are a
  public contract: 0 ok, 1 failure, 2 usage, 3 auth, 4 forbidden, 5 not found,
  6 unreachable.
- `apps/mcp` — one tool registry in `src/tools/`, two entrypoints in `src/bin/`.
  Every tool declares `requiredScopes`; the tool list is filtered by the
  credential's effective scopes.

### Go services (`apps/runner` + `packages/go/*`)

The product backend is NestJS. Go is for the one-off service that needs a
static binary, long-lived connections or process orchestration (runners, VMs,
containers) — `apps/runner` is the template, and the API talks to it with an
API key. The cross-cutting toolkit is `packages/go/*`, the Go counterpart of
`packages/backend/*`: one Go module each (`core`, `config`, `httpx`, `auth`,
`health`, `ws`, `postgres`, `selfupdate`), tied together by the root `go.work`, each also published to
Turborepo as `@oppenheimer/go-<name>` so the task graph and `--affected` see them.
`apps/runner` is more than the template now: it is the host agent. It pairs a
macOS, Debian or Ubuntu machine with a workspace, installs itself as a launchd
agent or systemd user unit, keeps itself on the current signed release, and
runs sessions as git worktrees with a tmux session each
(`runner run|register|install|sessions|status|update`; `runner serve` is the
template's HTTP service, which is what the container runs). The control-plane
link is the piece still missing, so sessions are driven from the host today.
The app is the same hexagon as `apps/api` in idiomatic Go: standard
`net/http` routing, `slog`, interfaces as ports, constructor injection, one
composition root (`internal/server`). Errors are the same RFC 7807 documents
with their own catalog (`RUNNER_*`, `APIKEY_*`). Boundaries are
enforced by `internal/arch/arch_test.go`. Rules in `.agents/rules/go.md`;
layer model in `apps/runner/ARCHITECTURE.md`; module list and "add a
module" steps in `packages/go/README.md`.

### Shared (packages/shared)

- Zod schemas are the single source of truth for DTOs
- CASL helpers shared between backend and frontend: `defineAbilitiesFromPermissions`
  (DB-driven, the source of truth) and the legacy `defineAbilitiesFor` fallback
- Types: `Role` (a free-form role-name `string`), `PermissionDefinition`,
  `AuthProvider`, `JwtPayload`, `TokenPair`, `PaginationParams`, `PaginatedResponse<T>`
- Constants: `AUTH` (token expiry, salt rounds), `PAGINATION`, `ROLES`,
  `SYSTEM_ROLES`, `SYSTEM_ROLE_PERMISSIONS`, `QUEUE_NAMES`

### Frontend (packages/frontend, the four apps)

The frontend is split twice, and the two splits answer different questions:

- **By product** for logic. `core` is the kernel every app loads (session,
  users, user settings, capabilities, analytics, the InversifyJS container,
  config, validation). `consumer` (`sessions`, `hosts`, and the account chrome:
  `organizations` as the personal workspace, `profile`, `api-tokens`) and
  `admin` (`admin-users`, `roles`) are the two products' domains
  (entities, repositories, services, TanStack Query hooks); an app loads
  exactly one, through `OppenheimerApp.create({ modules })`. The products never
  import each other — where they meet, the meeting point is a kernel contract.
- **By platform** for UI and glue. `web` and `mobile` hold what both apps of
  a platform share below their routes, organised by concern (`shell`, `auth`,
  `table`, `layout`, `forms`, `theme`, `i18n`, `analytics`, `platform`, …),
  each concern with the same kind directories a feature has. A kit imports the
  kernel only; a component that needs a product hook is a feature.
- **In the app**: routes compose, features contain. `features/<module>/`
  is named after a module of `core` or of the app's product package and holds
  only `screens/ sections/ dialogs/ forms/ components/ hooks/ lib/ __tests__/`.
  Features never import each other; `forms/` and `components/` never fetch;
  a route file stays under 120 lines.

The placement rules, the render rules (state at the lowest reader, effects
only in `hooks/`, the React Compiler on, no manual memo) and what enforces
them are `.agents/rules/frontend-architecture.md`. The layer model and the
cookbooks are `packages/frontend/ARCHITECTURE.md` and each app's
`ARCHITECTURE.md`; `/scaffold-feature` produces the shape; `pnpm arch`,
`pnpm check:structure` and Biome hold it.

### Web (apps/web)

- Vite SPA built to static assets, served by nginx in Docker
- Tailwind CSS v4, shadcn/ui components
- react-i18next for i18n (translations from `packages/translations`)
- React Hook Form + `zodResolver` for forms
- Vite env vars (`import.meta.env`, `VITE_`-prefixed) for configuration, read
  from the root `.env` (`envDir` in `vite.config.ts` points at the repo root)

### Control plane (apps/admin-web, apps/admin-mobile)

- Separate web and Expo entrypoints for platform administration
- Restricted to Better Auth `admin` and `superadmin` platform roles
- Owns user lifecycle, application-role assignment, and role permissions
- Has no public registration flow; consumer products remain in `apps/web` and
  `apps/mobile`

### Mobile (apps/mobile)

- Expo with expo-router
- NativeWind + `@oppenheimer/design-system-mobile` components for UI
- i18next for i18n (translations from `packages/translations`)
- React Hook Form + `zodResolver` for forms (`Controller` per field)
- expo-secure-store for secure token storage

#### Forms (both apps)

React Hook Form over a Zod schema from `@oppenheimer/shared`, resolver wired through
the app's `useZodResolver`. The convention is `.agents/rules/forms.md`.

### Design system (packages/frontend/design-system)

Two independently versioned packages with a mirrored component API:
`@oppenheimer/design-system-web` (Base UI + Tailwind v4, tokens in
`src/styles/globals.css`) for `apps/web` and `apps/web-showcase`, and
`@oppenheimer/design-system-mobile` (NativeWind + `@rn-primitives`) for `apps/mobile`
and `apps/mobile-showcase`. Usage rules are `.agents/rules/frontend-ui.md`.

## Dependency flow

```
packages/tsconfig         → used by all apps and packages (tsconfig extends)
packages/env              → used by api, mcp, mobile, admin-mobile (root .env loader)
packages/shared           → used by api, frontend, api-client, backend/core (wire types)
packages/auth             → used by api, web, mobile (shared Better Auth config)
packages/backend/core     → used by api, other backend packages
packages/backend/ddd      → used by api, backend/core (depends on nothing in the workspace)
packages/backend/email    → used by api
packages/backend/i18n     → used by api (bundles from packages/translations)
packages/backend/cache    → used by api
packages/backend/llm      → used by api
packages/backend/storage  → used by api
packages/backend/queue    → used by api
packages/translations        → used by web, mobile, api (email copy via backend/i18n)
packages/frontend/design-system/web    → used by web, admin-web, web-showcase, frontend/web
packages/frontend/design-system/mobile → used by mobile, admin-mobile, mobile-showcase, frontend/mobile
packages/frontend/api-client  → used by frontend/core, frontend/consumer, frontend/admin
packages/frontend/core        → used by every frontend package and app
packages/frontend/consumer    → used by web, mobile
packages/frontend/admin       → used by admin-web, admin-mobile
packages/frontend/web         → used by web, admin-web
packages/frontend/mobile      → used by mobile, admin-mobile
packages/go/core              → used by every other packages/go module and runner
packages/go/{config,httpx,auth,health,ws,postgres,selfupdate} → used by runner (auth ← ws, httpx ← health, auth)
```

## Commands

```bash
pnpm dev                # Start all apps
pnpm build              # Build everything
pnpm test               # Unit tests
pnpm test:integration   # Integration tests (needs Docker)
pnpm check              # Biome lint + format
pnpm arch               # Architecture boundaries (dependency-cruiser), API and frontend
pnpm check:structure    # Frontend layout contract: feature names, kinds, route cap, docs
pnpm docker:dev         # Start Postgres + Redis
pnpm generate:api-client # Regenerate typed API client (no database needed)
pnpm changeset          # Create a changeset for versioning
```

## Deployment

- **Tier 1 (~€4/mo)**: Hetzner VPS + Docker Compose for API/DB/Redis, free hosting for web/docs
- **Tier 2 (~€15-35/mo)**: Hetzner K8s + Helm charts (`helm/oppenheimer/`)
- Docker images built in CI (GitHub Actions), pushed to GHCR
- Mobile: EAS Build (Expo)

## When modifying code

- Shared types/schemas go in `packages/shared`, not duplicated in apps
- New env vars go in the root `.env.example` with a note on what they do; never
  add a per-package `.env` (see `.agents/rules/api-config.md`)
- New API endpoints need Swagger decorators and `@RequireScopes`; without the
  scope they are unreachable by API tokens and MCP clients. Afterwards run
  `pnpm generate:api-client`
- New MCP tools go in `apps/mcp/src/tools/`, declaring the same scope the endpoint requires
- Keep the pluggable service pattern: abstract class → concrete implementations → factory in module
- New translations go in `packages/translations/{locale}/index.json`
- Where frontend code goes — kernel, product package, platform kit, or a
  feature's kind directory — is `.agents/rules/frontend-architecture.md`;
  `/scaffold-feature` builds the shape and `pnpm check:structure` checks it
- UI in the web apps, `apps/web-showcase` and the web design system:
  `.agents/rules/frontend-ui.md`
- Routes in `apps/web` and `apps/admin-web` — a new URL, a guard, a layout
  route, search params, or anything that regenerates `routeTree.gen.ts` — is
  the `/tanstack-routing` skill (`.agents/skills/tanstack-routing/`). A route
  file's name is its URL, so a rename is a URL change
- Porting a design export onto the design system is the
  `/design-export-port` skill (`.agents/skills/design-export-port/`): the
  export's values go onto the token vocabulary in `globals.css` and the
  component rules in `packages/frontend/design-system/AGENTS.md` and
  `.agents/rules/frontend-ui.md`; it does not replace them. Fonts are system
  stacks. The MVP export is `product/versions/mvp/design/`
- Forms and Zod schemas: `.agents/rules/forms.md`
- Sign-up creates the account and its personal workspace in one go. The
  `/onboarding` screen is only the recovery path for an account that ended up
  with no workspace. Only `/register` passes the social `sign-up` intent
- `apps/web` must not import runtime values from the `@oppenheimer/shared` **root**:
  its CJS build is not tree-shakeable, so the whole graph lands in the bundle.
  Import a narrow subpath (`@oppenheimer/shared/schemas/auth`) or fetch from the API.
  Anything newly imported this way needs adding to `optimizeDeps.include` in
  `apps/web/vite.config.ts` for dev
- The same applies to `@oppenheimer/translations`: `apps/web` and `apps/admin-web`
  import metadata from `@oppenheimer/translations/locales` and catalogs from
  `@oppenheimer/translations/lazy`; only the default locale is bundled
- The web apps' critical path is budgeted: `pnpm check:bundle` fails past the
  number in `scripts/check-bundle-size.mjs`. Raise a budget only deliberately,
  in its own diff
- Compression, cache headers and the Content-Security-Policy for the SPAs live
  in `apps/web/nginx.conf` and `apps/admin-web/nginx.conf`. A new third-party
  origin goes in `CSP_EXTRA_ORIGINS`; anything the browser must run before
  React is a file in `public/`, the policy admits no inline script
