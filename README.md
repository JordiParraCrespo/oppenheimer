# Oppenheimer

**Run coding agents on your machines. Control them from anywhere.**

Claude Code and Codex already know how to code. Oppenheimer is the open-source
control plane that gives them a place to work: persistent sessions on
machines you trust, each isolated in its own git worktree and available from
the browser.

Start a task on your laptop. Close it. Check in from your phone. Pick it back
up from another computer. The agent, terminal, and working tree are still
there.

> [!IMPORTANT]
> Oppenheimer is under active development. The runner can already pair,
> install itself, and manage worktree-backed tmux sessions on macOS, Debian,
> and Ubuntu. The browser-to-runner relay is the next major slice, so sessions
> are currently driven from the host CLI rather than the web console.

## One control plane for every coding session

Coding agents are powerful, but running several of them quickly turns into a
mess of terminals, branches, credentials, and machines. Oppenheimer turns
that sprawl into one durable workspace:

- **Work from anywhere.** Open the same terminal from any browser, without
  exposing a port on your host.
- **Run in parallel without collisions.** Every session gets its own git
  worktree and tmux session.
- **Survive disconnects and updates.** Close the browser, lose Wi-Fi, or
  restart the runner; the work continues in tmux.
- **Keep control of the machine.** Run on your Mac or Linux box today, with
  isolated VMs coming in a later slice.
- **Keep credentials where they belong.** Agent credentials stay on your
  host. GitHub access uses short-lived, repository-scoped tokens that are
  never written to disk.

## The experience

1. Connect GitHub and choose the repositories Oppenheimer may access.
2. Add a Mac or Linux host with one command.
3. Pick a host, repository, branch, and coding agent.
4. Get a fresh worktree with the agent already running.
5. Leave and return from any device without losing the session.

The MVP is deliberately focused: your hosts, your repositories, and a
persistent terminal. Claude Code comes first; Codex and other agents follow.
VM isolation, previews, pull-request workflows, routines, and teams build on
the same foundation later.

## How it works

Oppenheimer has three moving parts:

| Part | Role |
| --- | --- |
| **Console** | The browser workspace for onboarding, creating sessions, and moving between terminals |
| **Control plane** | Identity, hosts, sessions, GitHub access, and the live relay between browser and runner |
| **Runner** | A small Go agent on your machine that owns worktrees, tmux sessions, PTYs, and signed self-updates |

The runner only makes outbound connections. A session is a git worktree plus
a tmux terminal, so it survives browser disconnects and runner restarts. The
control plane coordinates access; the work stays on your machine.

Read the [MVP scope](product/versions/mvp/00-scope.md) for the exact product
boundary or the [one-page brief](product/brief.html) for the wider vision.

## Quick start

You will need Node.js 22, pnpm, Docker, and Go.

```bash
# Install dependencies
pnpm install

# Configure the single root environment file
cp .env.example .env

# Start PostgreSQL and Redis
pnpm docker:dev

# Start the API, web console, and runner
pnpm dev:mvp
```

| Service | URL |
| --- | --- |
| Web console | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/api/docs |
| Documentation | http://localhost:3003 |
| Design-system showcase | http://localhost:3002 |

For the real local product loop—control plane, console, stubs, and a paired
runner host—see the [local stack instructions](.agents/skills/local-stack/SKILL.md).

## Repository map

### Product apps

| App | What it owns |
| --- | --- |
| [`apps/web`](apps/web) | Vite and TanStack Router console |
| [`apps/api`](apps/api) | NestJS control plane |
| [`apps/runner`](apps/runner) | Go host agent |
| [`apps/docs`](apps/docs) | Docusaurus documentation and error catalog |
| [`e2e`](e2e) | Playwright end-to-end suites |

Run the product apps together with `pnpm dev:mvp`.

### Shared foundations

| Package | What it owns |
| --- | --- |
| `packages/frontend/*` | Product logic, browser platform kit, generated API client, and web design system |
| `packages/backend/*` | DDD building blocks, authorization, errors, queues, cache, storage, email, and i18n |
| `packages/go/*` | Shared runner modules for config, auth, HTTP, WebSockets, health, persistence, and updates |
| `packages/shared` | Zod schemas, wire types, permissions, and credential scopes |
| `packages/auth` | Shared Better Auth configuration and client helpers |
| `packages/translations` | English and Spanish catalogs |

`apps/web-showcase` is the gallery for the shared web design system.

## Built for a real control plane

- **Frontend:** React, Vite, TanStack Router and Query, Tailwind CSS v4,
  shadcn/ui, Base UI
- **API:** NestJS, TypeORM, PostgreSQL, Redis, BullMQ, Better Auth
- **Runner:** Go, `net/http`, tmux, signed self-updates
- **Contracts:** Zod, OpenAPI, generated TypeScript client, RFC 7807 errors
- **Architecture:** Domain-Driven Hexagon modules with enforced dependency
  boundaries
- **Tooling:** pnpm, Turborepo, Biome, Vitest, Testcontainers, Playwright
- **Deployment:** Docker Compose and GitHub Actions

The monorepo runs affected packages in CI rather than rebuilding everything
for every pull request.

## Product thinking, in the open

The reasoning behind Oppenheimer lives alongside the code. [`product/`](product/README.md)
contains the research, decisions, trade-offs, and changes of direction in the
order they happened. Start there if you want to understand not only what the
project is building, but why.

## Common commands

```bash
pnpm dev:mvp              # Start the API, console, and runner
pnpm dev                  # Start every app
pnpm build                # Build all apps and packages
pnpm test                 # Run unit tests
pnpm test:integration     # Run integration tests (Docker required)
pnpm test:e2e             # Run Playwright end to end
pnpm check                # Check and fix formatting and lint issues
pnpm arch                 # Verify architecture boundaries
pnpm check:structure      # Verify frontend structure contracts
pnpm check:bundle         # Enforce the web bundle budget
pnpm generate:api-client  # Regenerate the client from OpenAPI
```

<!-- oppenheimer:begin starter -->
## Adapting the monorepo

Oppenheimer started from the Flama full-stack starter. Every app except the
API is optional and can be removed cleanly by the starter tooling:

```bash
pnpm starter:prune --list
pnpm starter:prune --without web-showcase,docs
```

Or ask a coding agent to use the `/starter-init` skill. Optional-app
references are tracked in `scripts/starter/features.json`, and
`pnpm starter:check` verifies that pruning cannot leave dead configuration or
documentation behind.
<!-- oppenheimer:end starter -->

## License

MIT
