---
sidebar_position: 7
---

# Go services

The product backend is NestJS and stays that way. Go enters for the one
service where Node is the wrong tool: a static binary with no runtime, tens
of thousands of long-lived connections, or orchestrating processes, VMs and
containers on a host. `apps/runner` is the template for that service, with a
working example workload so every layer is exercised before you replace it.

The consumer apps never talk to it. The NestJS API does, with an API key, and
the agents it manages talk back with short-lived service tokens.

## Same hexagon, idiomatic Go

The layer model mirrors `apps/api`; the machinery does not. Go has no
decorators and needs no DI container, so the same boundaries are expressed
with interfaces, constructors and package visibility:

| Concern              | NestJS (`apps/api`)                  | Go (`apps/runner`)                                   |
| -------------------- | ------------------------------------ | ---------------------------------------------------- |
| Module               | `@Module` + providers                | `internal/<ctx>/module.go` with `Options` and `New`  |
| Port                 | Abstract class + DI token            | Interface in `app/ports.go`                          |
| Adapter              | `@Injectable` bound to the token     | Struct asserting `var _ app.Port = (*Adapter)(nil)`  |
| Wiring               | Nest resolves the graph              | `internal/server` calls every constructor            |
| Errors               | `AppError` + `AllExceptionsFilter`   | `*problem.Error` returned from handlers              |
| Guards               | `@UseGuards`, `@CheckPolicies`       | `auth.Authenticate`, `auth.RequireScopes` on groups  |
| Boundary enforcement | dependency-cruiser                   | `internal/arch/arch_test.go`                         |

## Shared modules, the Go `packages/backend`

Everything domain-agnostic lives in `packages/go/*`, one Go module per
concern, tied together by a `go.work` at the repo root:

| Module   | Turborepo name     | Provides                                                   |
| -------- | ------------------ | ---------------------------------------------------------- |
| `core`   | `@oppenheimer/go-core`   | RFC 7807 documents, slog setup                             |
| `config` | `@oppenheimer/go-config` | Root `.env` loader, typed accessors that collect errors    |
| `httpx`  | `@oppenheimer/go-httpx`  | Router with middleware groups, JSON helpers, server        |
| `auth`   | `@oppenheimer/go-auth`   | Bearer middleware, `Principal`, scope grammar, JWT         |
| `health` | `@oppenheimer/go-health` | Liveness, readiness, capabilities                          |
| `ws`     | `@oppenheimer/go-ws`     | WebSocket hub with backpressure and keepalive              |
| `postgres` | `@oppenheimer/go-postgres` | Pooled pgx connection, advisory-locked SQL migrator, readiness checker |

Each module has a `package.json` whose scripts call `go` directly and which
declares the sibling modules it imports as workspace dependencies. That is
what lets Turborepo order builds, run `--affected` and invalidate caches
correctly: a change in `core` re-runs everything above it while `config`
stays cached. Every module also carries relative `replace` directives so it
builds and tidies on its own, which is what the Docker build relies on.

## What the template ships

- **Config** from the root `.env` outside production, real env vars winning,
  the bootstrap key required, service tokens optional and reported on
  `/health/capabilities`.
- **Errors** as the same RFC 7807 documents the API produces (from
  `packages/go/core/problem`), with the runner catalog listed on the
  [error reference](../errors.md#runner-service).
- **Authentication** by API key (`opr_…`, SHA-256 at rest, revocable,
  scoped) or HS256 service token, both resolving to one `Principal`.
- **Scopes** in the `resource:read|write` vocabulary of the
  [permission catalog](../tooling/permissions.md): `keys`, `events`.
- **REST** on the standard library router with request ids, panic recovery,
  structured access logs, body limits and a trusted-proxy setting.
- **WebSocket** hub with topic subscriptions, per-connection backpressure,
  ping keepalive and a `1001 Going Away` on shutdown.
- **Credentials** (`apikeys`) as the one bounded context so far: the host
  agent's product contexts (pairing, sessions) follow the same layout and
  are described in `apps/runner/ARCHITECTURE.md`.

## Choosing libraries

The standard library is the framework. Since Go 1.22 `net/http` routes by
method and path parameter, which removed the reason to reach for Gin, Echo,
Fiber or Gorilla's mux. The template adds exactly two dependencies:
`coder/websocket` and `golang-jwt`. Reach for `chi` only if you need route
groups the stdlib mux cannot express, and for `pgx` plus `goose` when the
in-memory repositories give way to Postgres.

## Running and building

```bash
pnpm --filter @oppenheimer/runner dev                 # reads the root .env
pnpm turbo run test --filter='./packages/go/*'  # the shared modules
make -C packages/go test                        # every Go module in go.work
docker build -f apps/runner/Dockerfile .        # distroless, non-root, ~10 MB
```

CI runs `go vet`, `golangci-lint` and the tests across the whole workspace
in a dedicated job (the race detector needs a C compiler the runners lack,
so `make test-race` is a local step), builds the Go packages through
Turborepo like the Node ones, and publishes the image alongside them. See
`apps/runner/ARCHITECTURE.md` for the "add a bounded context" cookbook.
