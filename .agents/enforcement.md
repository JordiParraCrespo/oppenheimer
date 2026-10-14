# What enforces each rule

Every rule an agent is held to, paired with what fails when it is broken. A
rule nothing enforces reaches an agent only if the agent opens the file it is
written in, so its row says so. The `/correct` skill
(`.agents/skills/correct/`) keeps this table current: a correction for a rule
already listed here as "rule text only" is a repeat, and is fixed at the
highest level that works in the same change.

"`ci:local`" means a step in `scripts/ci/local.mjs`, which runs before every
push and on `main` every eight hours. "Stop hook" means
`.agents/hooks/arch-check.sh`, which blocks an agent's turn from ending.
"Shell hook" means `.agents/hooks/git-guard.mjs`, which refuses the command
before it runs.

## Open: claimed or relied on, not enforced

| Rule | Written in | State |
|---|---|---|
| Conventional commits, with a scope from the allowed list | `AGENTS.md`, `commitlint.config.js` | Nothing runs commitlint: no hook, no `ci:local` step. Of the 224 non-merge commits on `main` at `e800a364`, 127 fail the config, 108 of them on `scope-enum`, whose hand-kept list has `mobile` and lacks `runner`, `sessions`, `product`, `deploy` and `skills`. |
| Run `pnpm generate:api-client` after an endpoint changes | `AGENTS.md` | Rule text only. No step compares the committed client with a fresh generation. |
| Every `CLAUDE.md` is a symlink to the `AGENTS.md` beside it | `AGENTS.md` | Rule text only. Holds today (35 links, no plain files). |

## Agent guardrails

| Rule | Written in | Enforced by | Runs in |
|---|---|---|---|
| No push to `main`/`master`, no force push, no deleting a remote branch | `AGENTS.md` | `git-guard.mjs`, and the glob denies in `.claude/settings.json` | Shell hook; its cases in `pnpm check:hooks` (`ci:local`) |
| No `git reset --hard`, no `git branch -D` | `AGENTS.md` | `git-guard.mjs`, `.claude/settings.json` | Shell hook, `pnpm check:hooks` |
| Stage files by path: no `git add -A`/`--all`/`.`/`*` | `AGENTS.md` | `git-guard.mjs`, `.claude/settings.json` | Shell hook, `pnpm check:hooks` |
| Never stage an env file other than `.env.example` | `AGENTS.md`, `api-config.md` | `git-guard.mjs` | Shell hook, `pnpm check:hooks` |
| No `sudo`, no download piped into a shell, no reading credential files | `AGENTS.md` | `.claude/settings.json` denies | Claude Code permissions |
| Edits are formatted | `AGENTS.md` | Biome on every edit | `.claude/settings.json` hook |

## Repository-wide

| Rule | Written in | Enforced by | Runs in |
|---|---|---|---|
| Lint and format with Biome | `AGENTS.md` | `biome check .` | `ci:local` |
| A line about an optional app sits in `# oppenheimer:begin/end <id>` markers | `AGENTS.md` | `scripts/starter/prune.mjs --check` | `pnpm starter:check` (`ci:local`) |
| Every workspace package has a `README.md` and an `AGENTS.md`, every `AGENTS.md` points at a rule file | `AGENTS.md` | `scripts/check-frontend-structure.mjs` | `pnpm check:structure` (`ci:local`) |
| One `.env` at the root; every variable the API reads is in `.env.example`, and nothing else is | `AGENTS.md`, `api-config.md` | `apps/api/src/__tests__/environment-coverage.spec.ts` | `turbo test` (`ci:local`) |
| Generated protocol files are committed and current | `packages/shared/AGENTS.md` | `check:generated` plus `git diff --exit-code` | `ci:local` |
| A temporary feature flag is gone by its `expiresAt`; no flag is declared but unread | `feature-flags.md` | `scripts/check-feature-flags.mjs` | `pnpm check:flags` (`ci:local`) |
| A new workspace dependency of the API is listed in its Dockerfile | The spec's own header | `apps/api/src/__tests__/dockerfile-workspace-deps.spec.ts` | `turbo test` |

## API (`apps/api`)

| Rule | Written in | Enforced by | Runs in |
|---|---|---|---|
| Every module has the same anatomy, and a file's name says its layer | `ARCHITECTURE.md`, `nestjs-architecture.md` | `scripts/check-api-structure.mjs`, with a `LEDGER` of known breaches | `pnpm check:api-structure` (`ci:local`) |
| The domain stays pure and imports nothing outward | `nestjs-architecture.md` | dependency-cruiser `domain-stays-pure`, `domain-no-outward-imports` | `pnpm arch` (`ci:local`), Stop hook |
| Handlers depend on the port, never the adapter; controllers go through the bus | `nestjs-architecture.md`, `nestjs-di.md` | `handlers-depend-on-port-not-adapter`, `controllers-go-through-the-bus` | `pnpm arch`, Stop hook |
| TypeORM and ORM entities stay in the adapters | `typeorm.md` | `typeorm-stays-in-the-adapters`, `orm-entity-stays-in-database` | `pnpm arch`, Stop hook |
| Better Auth stays behind an adapter; auth is a kernel | `08-auth.md`, `nestjs-architecture.md` | `better-auth-stays-behind-an-adapter`, `auth-is-a-kernel` | `pnpm arch`, Stop hook |
| No cross-slice imports, no reaching into another module's internals, no cycles | `nestjs-architecture.md` | `no-cross-slice-imports`, `no-cross-module-internals`, `no-circular` | `pnpm arch`, Stop hook |
| Every route declares `@CheckPolicies` or a reasoned `@NoPolicy` | `rbac-roles.md` | `route-policy-coverage.spec.ts` | `turbo test` |
| Every route declares its scopes, and the inventory is current | `scopes-and-credentials.md` | `route-scope-coverage.spec.ts`, `route-scopes.inventory.json` | `turbo test` |
| An error code has a catalog entry, an `@ApiProblemResponse`, a row in `errors.md` and a message in every locale | `nestjs-architecture.md` | `error-catalog-coverage.spec.ts` | `turbo test` |
| An operation's name follows one rule, not a decorator per route | `api-config.md` | `openapi-document.spec.ts` | `turbo test` |
| Every migration has a timestamp of its own | `database-design.md`, `typeorm.md` | `migration-timestamps.spec.ts` | `turbo test` |
| Schema-wide rules hold on what the migrations build, and every `down()` reverts | `database-design.md` | `schema.integration.spec.ts` | `ci:local` integration job |
| Every call to an upstream goes through `UpstreamLimiter.exchange` | `integrations.md` | Rule text only | |

## Runner and Go (`apps/runner`, `packages/go`)

| Rule | Written in | Enforced by | Runs in |
|---|---|---|---|
| Import boundaries between the runner's contexts and layers | `apps/runner/ARCHITECTURE.md`, `go.md` | `internal/arch/arch_test.go` | `go test` (`ci:local`) |
| An error code is unique across contexts and has a row on the docs site | `go.md` | `internal/arch/catalog_test.go` | `go test` |
| `go vet` and `golangci-lint` are clean; the runner builds for every release target | `go.md` | `go vet`, `golangci-lint`, cross-builds | `ci:local` go job |
| Release publishing keeps its contract | `09-runner-install-and-update.md` | `scripts/runner/publish.test.mjs` | `pnpm check:runner-release` (`ci:local`) |

## Frontend (`apps/web`, `packages/frontend`)

| Rule | Written in | Enforced by | Runs in |
|---|---|---|---|
| Features never import each other | `frontend-architecture.md` | dependency-cruiser `features-are-islands` | `pnpm arch` (`ci:local`), Stop hook |
| `forms/` and `components/` never fetch; features query through the product package | `frontend-architecture.md` | `forms-and-components-stay-pure`, `features-query-through-the-product` | `pnpm arch`, Stop hook |
| The kernel and the kit know nothing of the product or the app | `frontend-architecture.md` | `kit-knows-no-product`, `kit-knows-no-app`, `domain-knows-no-react`, `domain-knows-no-platform` | `pnpm arch`, Stop hook |
| Routes compose; a route file stays under 120 lines | `frontend-architecture.md` | `routes-compose`, `check-frontend-structure.mjs` | `pnpm arch`, `pnpm check:structure` |
| A feature is named after a module and holds only the kind directories | `frontend-architecture.md` | `check-frontend-structure.mjs` | `pnpm check:structure`, Stop hook |
| No screen paints the ground or rebuilds the shell's frame | `frontend-ui.md` | `check-frontend-structure.mjs` | `pnpm check:structure` |
| A `<QueryState>` draws every rung of a read | `frontend-ui.md` | `scripts/query-state-slots.mjs` | `pnpm check:structure` |
| No manual memo; effects live only in `hooks/` | `frontend-architecture.md` | Biome `noRestrictedImports`, with a message naming the fix | Biome (`ci:local`) |
| Query keys come from the feature's key factory, a mutation's cache update goes through `withCacheOnSuccess`, a gated query uses `skipToken` | `frontend-architecture.md`, `packages/frontend/ARCHITECTURE.md` | `biome-plugins/*.grit`, held by their fixtures | Biome, `pnpm check:biome-plugins` (`ci:local`) |
| A component the compiler bails out of is visible | `frontend-architecture.md` | `scripts/check-react-compiler.mjs --strict` | `ci:local` |
| No unused files, exports or dependencies | `frontend-architecture.md` | knip | `pnpm check:unused` (`ci:local`) |
| One installed copy of each React singleton | `AGENTS.md` | `scripts/check-singletons.mjs` | `pnpm check:singletons` (`ci:local`) |
| The first load stays within budget | `AGENTS.md` | `scripts/check-bundle-size.mjs` | `pnpm check:bundle` (`ci:local`) |
| Reach for the design system before writing markup | `frontend-ui.md` | `@shadcn/lint` through oxlint, which reports and never fails | `pnpm lint:design` (`ci:local`, advisory) |
