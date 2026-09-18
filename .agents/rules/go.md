---
paths:
  - "apps/runner/**/*"
  - "packages/go/**/*"
  - "go.work"
---

# Go Service Rules

`apps/runner` is the Go template for services the NestJS API delegates to,
and `packages/go/*` is the shared toolkit it is built from — the Go
counterpart of `packages/backend/*`. It is the same hexagon as `apps/api`,
written the way the Go community writes services — not a port of NestJS
idioms.

## Modules and the workspace

- Every directory under `packages/go/` is its own Go module
  (`github.com/jordiparracrespo/oppenheimer/packages/go/<name>`), listed in the
  root `go.work`. Each module's `go.mod` carries a `require` **and** a
  relative `replace` for every sibling it imports, transitively — `go mod
  tidy` ignores `go.work`, and the Docker build must work without it.
- A shared module never imports an app. Anything a second service could use
  goes to `packages/go`; anything that names hosts, sessions, keys or this service's
  scopes stays in the app.
- Each module has a `package.json` (`@oppenheimer/go-<name>`) whose scripts call
  `go` directly (the CI runners have no `make`), and declares the sibling
  modules it imports as `workspace:*` devDependencies. That declaration is
  the Turborepo graph: without it `--affected` and `^build` do not see the
  edge. New module ⇒ `go.work`, `package.json`, `pnpm install`.
- The repo root is not a module: use
  `go test github.com/jordiparracrespo/oppenheimer/...` or
  `make -C packages/go <target>`, never `./...` from the root.

## Layout and boundaries

- `cmd/<binary>/main.go` only parses signals, loads config, builds the logger
  and calls `server.New`. No wiring lives in `main`.
- `internal/server` is the **composition root** of `runner serve`, and
  `internal/cli` is the composition root of the host agent's subcommands:
  those two are the only packages that name concrete adapters. A context's
  `module.go` may pick its own defaults. `cmd/runner/main.go` parses flags and
  dispatches; it wires nothing.
- A subcommand is a method on `cli.App`, not logic in `main`. Anything a
  second entry point would need (the `~/.oppenheimer` layout, which init
  system this platform uses) lives in `internal/cli`, not in a context.
- A bounded context is `internal/<name>/{domain,app,adapters/*,module.go}`.
  `domain` imports nothing but `core/problem`, `auth/scope` and the app's
  `scopes`; `app` adds `auth` and `core`; adapters import their own context
  and any `packages/go` module. `internal/arch/arch_test.go` fails the build
  on anything else — add every new context to its `contexts` list.
- `packages/go/*` is domain-agnostic. If a shared module needs to know about
  sessions or keys, invert it: declare an interface or callback (`ws.Authorizer`,
  `auth.Verifier`) and let the context supply it.

## Dependency injection

- Constructors take an `Options` struct; nothing reads globals or `os.Getenv`
  outside `internal/config`.
- Ports are interfaces declared **next to the use case** (`app/ports.go`),
  not next to the adapter. Adapters assert conformance:
  `var _ app.Repository = (*Repository)(nil)`.
- A nil optional dependency is a nil interface, never a typed nil pointer
  wrapped in one (see `internal/server` around the JWT issuer).

## Errors

- Handlers are `httpx.HandlerFunc` and **return** errors; they never write
  error bodies. The router renders `*problem.Error` as `application/problem+json`
  and everything else as an opaque 500 logged with the correlation id.
- Catalog entries are package-level `problem.New("<CTX>_00n", status, title)`
  values in `<ctx>/domain/errors.go`. `title` is stable; per-request text goes
  through `WithDetail`. Every code gets a row under "Runner service" in
  `apps/docs/docs/errors.md` — `internal/arch/catalog_test.go` fails the build
  when a code is reused or undocumented, so neither is a review-time catch.
- Domain methods return sentinel `errors.New` values or typed errors; the
  **use case** maps them to problems. The domain never imports HTTP.
- Wrap with `%w`, compare with `errors.Is`/`errors.As`. `golangci-lint`'s
  `errorlint` enforces it.

## Authentication and scopes

- Every route under `/v1` sits behind `auth.Authenticate`; scope checks are
  `auth.RequireScopes` on a router group, never inline `if` checks.
- New resources get scopes in the app's `internal/scopes` catalog
  (`resource:read|write`; `write` implies `read`); the grammar and `Set`
  live in `packages/go/auth/scope` and are never redefined per service. Keys and tokens can only carry scopes their minter
  holds — keep that check in the use case.
- On a host, the identity files are 0600 and their directory 0700, written
  atomically (temp file, rename). A key any other account can read is refused,
  not used.
- Nothing downloaded is trusted before it is verified, and nothing that failed
  verification survives on disk. The release-signing key is never in CI, in a
  config file or on a host: only its public half, compiled into the binary.
- Secrets are compared with `crypto/subtle.ConstantTimeCompare`, stored as
  SHA-256 (they are 256-bit random, not passwords), and never logged. A
  verifier reports one `ErrInvalidCredential`; the reason is for the log.

## HTTP and WebSocket

- Standard `net/http` mux with `METHOD /path/{param}` patterns. No framework;
  `chi` is the only acceptable addition if groups outgrow `httpx.Router`.
- Never set a global write timeout on the server — it kills WebSockets. Bound
  headers (`ReadHeaderTimeout`) and bodies (`httpx.MaxBytes`) instead.
- One goroutine writes to a socket. Publishers enqueue on a bounded channel
  and a full channel closes the client (`ws/conn.go`); never block a publisher
  on a slow consumer.
- Long-lived work takes a `context.Context` and stops when it is cancelled;
  stopping a session is a context cancellation, not a flag the loop polls.

## Config and environment

- The root `.env` is the only env file. `internal/config` loads it outside
  production and never overwrites a real variable. Every new variable gets a
  note in the root `.env.example` under "Runner (apps/runner)".
- Required secrets fail `config.Parse` with every problem listed at once.
  Optional capabilities are nil pointers (`cfg.JWT == nil`), reported by
  `/health/capabilities`, never sentinel strings.

## Tooling

- `make -C packages/go lint` (golangci-lint, config in the root
  `.golangci.yml`) and `make -C packages/go test` are what CI runs across
  the workspace; `make test-race` is local only (the runners have no C
  compiler). All three must be clean before a push that touches goroutines.
- Add a dependency only when the standard library cannot do the job, and pin
  it in `go.mod` with `go mod tidy`.
- Tests use `httptest` end to end (`internal/server/server_test.go`) and the
  in-memory adapters; nothing in `pnpm test` needs Docker.
