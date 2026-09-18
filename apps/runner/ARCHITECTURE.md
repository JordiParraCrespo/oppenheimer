# Architecture

The service is a hexagon, the same shape as `apps/api`, expressed in idiomatic
Go: interfaces for ports, constructors for injection, `internal/` for
everything not meant to be imported, and one composition root that is the
only place concrete adapters are named. Everything domain-agnostic lives in
the shared modules under `packages/go/` (the Go counterpart of
`packages/backend/*`); this app holds only what is specific to it.

```
packages/go/                  shared toolkit, one Go module each (see its README)
  core/problem core/logging   RFC 7807 documents, slog setup
  config/                     root .env loader, typed env accessors
  httpx/                      router, middleware, JSON, server lifecycle
  auth/ auth/scope            Principal, bearer middleware, scope grammar + guard, JWT
  health/                     /healthz /readyz /health/capabilities
  ws/                         hub, connection, envelope, upgrade handler

apps/runner/
cmd/server/main.go            signals, config, logger → server.New → httpx.Serve
internal/
  server/                     composition root: the only importer of adapters
  config/                     the variables this service reads → Config
  scopes/                     this service's scope catalog on auth/scope
  apikeys/                    bounded context: credentials
    domain/                   aggregate, invariants, error catalog
    app/                      use cases + ports (Repository, TokenIssuer)
    adapters/http             REST
    adapters/memory           in-process Repository
    adapters/postgres         pgx Repository + migrations
    module.go                 wires the context's default adapters
  arch/                       import-boundary test
```

The product contexts are designed in `product/versions/mvp/02-runner.md` §3
and are not here yet. They arrive in this order, each in the same layout as
`apikeys`:

1. `pairing` — registration token, host keypair, host identity, boot JWT.
2. `link` — the one outbound WebSocket: dial, auth, multiplexed streams,
   heartbeat, reconnect ladder with an epoch counter.
3. `sessions` — the aggregate, with `adapters/tmux`, `adapters/git` and
   `adapters/manifest` behind the `Terminals`, `Worktrees` and `Classifier`
   ports.
4. `credentials` — the per-session GitHub token cache behind the git
   credential helper on the local Unix socket.
5. `host` — preflight facts, agent versions, disk pressure.
6. `updates` — channel, safe window, staging and rollback, on top of a new
   `packages/go/selfupdate` module that holds the domain-agnostic half
   (verify, atomic swap, prune). Install and update are
   `product/versions/mvp/09-runner-install-and-update.md`.

`apikeys` goes once `pairing` replaces it as the way this host proves who it
is. Two contexts never import each other: where one needs another, the
consumer declares a port in its `app` and `internal/server` supplies the
other context's service as the implementation.

Two shape changes come with `run`. `cmd/server` becomes `cmd/runner`, whose
`main` dispatches the subcommands (`run`, `register`, `install`, `status`,
`credential-helper`, `update`, `selfcheck`) and still does no wiring. And on
a paired host the router is bound to a 0600 Unix socket
(`~/.oppenheimer/run/runner.sock`) rather than a TCP port, because the host
must expose nothing: the same `httpx` router and the same problem documents,
on a different `net.Listener`.

## Layers and the rule between them

| Layer         | May import                                                       | Never imports                    |
| ------------- | ---------------------------------------------------------------- | -------------------------------- |
| `domain`      | `core/problem` (its catalog entries), `auth/scope`, `scopes`     | anything else                    |
| `app`         | its own `domain`, `auth`, `core/*`, `scopes`                     | adapters, other contexts         |
| `adapters`    | its own `app` and `domain`, any `packages/go` module, `scopes`   | other contexts, `server`         |
| `module.go`   | its own context, any `packages/go` module                        | other contexts                   |
| `server`      | everything                                                       | —                                |
| `packages/go` | other `packages/go` modules                                      | any app                          |

`internal/arch/arch_test.go` enforces the table. It walks every non-test file,
parses imports only, and fails with the offending file and rule. It is the
Go equivalent of `apps/api/.dependency-cruiser.cjs` and runs under `pnpm test`.

## Conventions that replace NestJS machinery

| NestJS                              | Here                                                                  |
| ----------------------------------- | --------------------------------------------------------------------- |
| `@Module` + DI container            | `module.go` with an `Options` struct; `server.New` calls the constructors |
| `@Injectable` service               | A struct with a `New(opts)` constructor                               |
| Command / query handlers            | Methods on the context's `app.Service` (split into two types when it grows) |
| Repository port + DI token          | An interface in `app/ports.go`; the adapter asserts `var _ app.Repository = (*Repository)(nil)` |
| `AppError` + `AllExceptionsFilter`  | `*problem.Error` returned from handlers; the router writes the document |
| `@UseGuards(AuthGuard)`             | `auth.Authenticate` on the router group                               |
| `@RequireScopes`                    | `auth.RequireScopes` on a sub-group                                   |
| Domain events + outbox              | `app.Publisher` port; the ws adapter fans out. Add an outbox adapter when durability matters |
| Swagger decorators                  | `api/openapi.yaml` (hand-written; see "Next steps")                   |

## Request lifecycle

```
RealIP → RequestID → Recover → Logger → SecurityHeaders → MaxBytes
   └─ /healthz /readyz /health/capabilities            (public)
   └─ Authenticate(JWT, api keys)                      (everything under /v1)
        ├─ RequireScopes(keys:read)  GET /v1/api-keys…
        ├─ RequireScopes(keys:write) POST/DELETE /v1/api-keys, POST /v1/service-tokens
        └─ GET /v1/ws → per-topic authorizer (events:read)
```

Handlers are `func(w, r) error`. A returned `*problem.Error` becomes its
document; any other error becomes an opaque 500 whose cause is logged with
the correlation id. Handlers therefore never write error bodies.

## Authentication

`auth.Verifier` is the port; the middleware picks the first verifier whose
`Accepts` matches the token's shape. Two implementations exist:

- `auth.JWT` (platform) — HS256 service tokens. Verifies `exp`, `iss`, `aud`,
  and the space-separated `scope` claim.
- `apikeys/app.Service` (context) — minted keys by their `opr_` prefix and
  the bootstrap key by constant-time hash comparison. Verifying touches
  `LastUsedAt`.

Both produce an `auth.Principal` on the context; use cases read it with
`auth.FromContext` when they need the caller (audit fields, scope subset
checks when minting).

## WebSocket

`ws.Hub` is one shared fan-out: connections subscribe to topics, contexts
publish to topics. Every connection has a bounded send queue and a dedicated
writer goroutine; a client that cannot keep up is closed rather than allowed
to stall a publisher. The hub is domain-agnostic — a context supplies a
`ws.Authorizer` for the topics it owns, and the composition root chains them
into the upgrade handler (`server.authorizeEvents` is the placeholder until
the first context owns a topic). Shutdown closes every
socket with `1001 Going Away` before the HTTP drain.

## Adding a bounded context

1. `internal/<name>/domain/` — the aggregate with its invariants as methods
   returning sentinel errors, plus `errors.go` with the context's
   `problem.New("<NAME>_00n", status, title)` entries. Document each code on
   the docs site's error reference.
2. `internal/<name>/app/ports.go` — the interfaces the use cases need.
   `service.go` — the use cases; map sentinel domain errors to problems here.
3. `internal/<name>/adapters/<kind>/` — one package per technology. The REST
   adapter mounts its own scope groups; the memory adapter is the default
   repository so tests need nothing external.
4. `internal/<name>/module.go` — `Options` + `New` + `Mount`.
5. Add the context name to `contexts` in `internal/arch/arch_test.go` and
   its scopes to `internal/scopes` (the grammar is `packages/go/auth/scope`).
6. Wire it in `internal/server/server.go`.

## Next steps this template leaves open

- **Persistence**: done for Postgres — `internal/apikeys/adapters/postgres`
  implements the `Repository` port on `pgx` behind `RUNNER_DATABASE_URL`,
  with the shared pool and migrator in `packages/go/postgres`; the memory
  adapter remains the default and the reference behaviour. Embedded SQLite
  (`modernc.org/sqlite`) is the same pattern if a zero-dependency store is
  ever wanted, which a host agent installed as the user's account will.
- **OpenAPI**: write `api/openapi.yaml` by hand or generate it with
  `oapi-codegen`, then point `pnpm generate:api-client` at it so the NestJS
  side talks through a typed client.
- **Metrics/tracing**: add a `/metrics` handler and an OpenTelemetry
  middleware in `platform`; nothing else changes.
- **Rate limiting**: a per-principal token bucket as one more `httpx.Middleware`.
