# Oppenheimer — Agent Instructions

## Project overview

Oppenheimer is a browser-based terminal and VM orchestrator: connect a host
you own (later: a VM), get sessions on it, each a git worktree with a tmux
terminal running Claude Code or Codex, streamed to the browser through a
control plane. The codebase is a Turborepo + pnpm monorepo started from the
Flama full-stack starter. The MVP is `apps/api` (control plane), `apps/web`
(the console), `apps/runner` (the host agent), `apps/docs` and `e2e`; that is
what `pnpm dev:mvp` starts. Beyond the MVP are `apps/web-showcase`, the
gallery of the web design system, and `apps/extension`, a Chrome extension
that tracks your Claude Code cloud sessions and tells you which need you.

The runner pairs a macOS, Debian or Ubuntu machine with a workspace, installs
itself as a user service, keeps itself on the current signed release, and
holds one outbound WebSocket to the control plane (`apps/runner/internal/link`
on the host, the API's `relay` and `links` modules on the other end): the
console drives sessions over it, and `runner sessions …` drives the same
lifecycle from the host. `apps/runner/README.md` says what works today.

## Product notes

All research and decisions live in `product/`; start with `product/README.md`.

- The MVP scope is `product/versions/mvp/00-scope.md`, its in-depth design one
  document per area in `product/versions/mvp/` (decision log in its README);
  what comes after is `product/next-steps/`. `product/07-mvp.md` is
  superseded, kept for history.
- Workspaces are personal: the Better Auth `organization` row is the one
  workspace, created at sign-up with the account as its single owner. No
  roster, invitations or teams in the console (`product/versions/mvp/08-auth.md`;
  `AUTHORIZATION.md` is the starter's kernel design, kept as history).
- When a decision changes, update the note that made it and add a line to
  the "decisions that changed" list in `product/README.md`. Do not silently
  rewrite history in earlier notes. `product/brief.html` is regenerated from
  the notes; keep it in sync when a note changes.
- The runner is `product/versions/mvp/02-runner.md` and
  `…/09-runner-install-and-update.md`; the wire is `…/01-protocol.md`.

## Monorepo map

```
apps/        api (NestJS control plane; authorization in src/authz) · web (Vite + TanStack Router console)
             runner (Go host agent) · docs (Docusaurus) · extension (Chrome)
             web-showcase (Next.js gallery of the design system)
packages/    shared (Zod schemas, types, CASL, scope + flag catalogs, the link protocol)
             auth (Better Auth config) · env (root .env loader) · tsconfig
             translations (i18n JSON)
             backend/  agents cache core ddd email i18n llm queue storage
             frontend/ core (kernel) · consumer (the console's domain) · web (platform kit)
                       api-client (generated) · design-system/web (shadcn/ui + Base UI + Tailwind v4)
             go/       core config httpx auth health ws postgres selfupdate execx
deploy/dev/  the dev deployment (README is the runbook) · docker/ Compose · .github/
```

Who uses whom:

```
tsconfig → everything · env → api · shared → api, auth, backend/core, frontend/*
backend/* → api (ddd depends on nothing; agents is the only code that imports an agent SDK,
             and depends on llm for the shared LlmService and LlmRateLimitError)
translations → web, frontend/web, api (email copy via backend/i18n)
design-system/web → web, web-showcase, frontend/web
api-client → frontend/core, frontend/consumer · frontend/core → every frontend package, web
frontend/consumer, frontend/web → web · go/core → every go module · go/* → runner
```

Each app and package has a `README.md` (purpose, exports, usage) and an
`AGENTS.md` (the rules an agent needs there). Every `CLAUDE.md` in the repo is
a symlink to the `AGENTS.md` beside it: edit the `AGENTS.md`, never the link.

<!-- oppenheimer:begin starter -->
Every app above except `api` is optional. `scripts/starter/features.json`
lists them with the paths and marked config blocks that go with each one, and
`/starter-init` is the skill that turns the starter into a project: a short
dialog about what the user is building, a proposal of what to keep, then
`scripts/starter/prune.mjs` removes the rest and the skill rewrites the prose.
When you add a file that mentions an optional app (CI, compose,
`.env.example`, a sidebar), wrap the lines in `# oppenheimer:begin <id>` /
`# oppenheimer:end <id>`; `pnpm starter:check` fails otherwise.
<!-- oppenheimer:end starter -->

## Hard rules

- **CI is local.** No git hooks and no CI on pull requests. The pipeline is
  `scripts/ci/plan.mjs`, run by `pnpm ci:local` (`scripts/ci/local.mjs`), its
  jobs side by side and stopping at the first failure; what it selects is
  `scripts/ci/affected.mjs` and `selection.mjs`. A new CI step goes in the
  plan and nowhere else. Before you push: commit, run `pnpm ci:local`, push
  only on a green run, and paste `.ci-local/report.md` into the pull request;
  while working, `pnpm ci:local --dirty` lints uncommitted work.
  `.github/workflows/ci.yml` runs `pnpm ci:local --all` on `main` on a
  schedule; a red run opens a `main-red` issue, which comes before new work.
  Driving a pull request, and the order of its steps, is the `/steward` skill.
- **Stage files by path.** `.claude/settings.json` and the hooks in
  `.agents/hooks/` refuse `git add -A`/`.`, pushes to `main`, force pushes,
  `git reset --hard` and the like; read them for the exact policy and for
  what else runs on an edit, a push or the end of a task.
- **A change to what the console shows gets light and dark screenshots,
  every time.** What counts is defined once, in `.agents/hooks/visual-change.mjs`;
  how to take them is the `/local-stack` skill ("Show a visual change"); the
  pull request's `## Screenshots` section is `/steward`. A change there that
  is not visual records why with `pnpm screens --not-visual "<why>"`.
- **One `.env`, at the repo root.** The root `.env.example` documents every
  variable with a note; a new variable goes there. Never add a per-package
  `.env`. Node apps load it through `@oppenheimer/env` (real env vars win),
  the web app through Vite's `envDir`.
- **Conventional commits** (commitlint). Versioning is Changesets, per
  package (`pnpm changeset`).
- Biome lints and formats; the one ESLint-family tool is `pnpm lint:design`
  (`@shadcn/lint` through oxlint, design-system rules only).
- Shared types and Zod schemas go in `packages/shared`, never duplicated in
  an app. A new API endpoint needs Swagger decorators and `@RequireScopes`,
  then `pnpm generate:api-client`. A new error code needs a row in
  `apps/docs/docs/errors.md`. New copy goes in `packages/translations`.
- A test names the behavior it protects and the regression that breaks it,
  lives at the owner boundary, and needs no test-only production seam.
<!-- oppenheimer:begin web -->
- A library that holds module state installs once for `apps/web`: the list
  is `singletons` in `apps/web/package.json`, held by `pnpm check:singletons`.
<!-- oppenheimer:end web -->

## Where to read more

Rules in `.agents/rules/` load on their own for the paths in their
frontmatter; this is the index.

| When you are… | Read |
| --- | --- |
| writing anything in `apps/api` | `apps/api/ARCHITECTURE.md` (Domain-Driven Hexagon), `nestjs-architecture.md` (slices, CQRS, errors as RFC 7807, events), `nestjs-di.md`, `api-config.md` (config, controllers, Swagger, rate limits); a new module is `/scaffold-module` |
| touching a table, an entity or a migration | `database-design.md`, `typeorm.md`; a new table is `/design-database` |
| writing or pruning a backend test | `testing-backend.md`; the value bar is `/test-audit` |
| building a `packages/backend/*` package | `backend-packages.md` (exports, pluggable vs library) |
| guarding a route | `rbac-roles.md` (roles), `scopes-and-credentials.md` (API tokens, OAuth clients) |
| adding or reading a feature flag | `feature-flags.md` |
| calling a system we do not run | `integrations.md` (rate-limit budgets); a new vendor is `/integrate-provider` and `provider-integrations.md` |
| writing Go (`apps/runner`, `packages/go`) | `go.md`, `apps/runner/ARCHITECTURE.md`, `packages/go/README.md` |
| placing frontend code | `frontend-architecture.md`, `packages/frontend/ARCHITECTURE.md`, `apps/web/ARCHITECTURE.md`; a new screen is `/scaffold-feature`, a review is `/frontend-audit` |
| writing markup or styles | `frontend-ui.md` and the design system's `AGENTS.md`; a design export is `/design-export-port` |
| building a form | `forms.md` |
| adding or changing a route in `apps/web` | `/tanstack-routing` |
| checking a change end to end | `/local-stack`; the e2e suites are `e2e/README.md` |
| deploying | `deploy/dev/README.md`, `apps/docs/docs/deployment/` |

## Commands

```bash
pnpm dev | pnpm dev:mvp   # Start all apps | the MVP
pnpm build                # Build everything
pnpm test                 # Unit tests
pnpm test:integration     # Integration tests (needs Docker)
pnpm check                # Biome lint + format
pnpm arch                 # Architecture boundaries (dependency-cruiser), API and frontend
pnpm check:structure      # Frontend layout contract
pnpm check:flags          # Feature flags: none past expiry, none declared but unread
# oppenheimer:begin web
pnpm check:singletons     # One installed copy of each React singleton for apps/web (pnpm-lock.yaml)
# oppenheimer:end web
pnpm docker:dev           # Start Postgres + Redis
pnpm ci:local             # CI, locally: what the branch touches (--all for everything, --dirty to lint uncommitted work)
# oppenheimer:begin e2e
node scripts/stack/stack.mjs up [--web]  # The stack the e2e suites run against (e2e/README.md)
# oppenheimer:end e2e
pnpm generate:api-client  # Regenerate the typed API client (no database needed)
```

`package.json` lists the rest (`check:compiler`, `check:unused`,
`check:bundle`, `monitoring:up`, …).
