# @oppenheimer/go-health

The three unauthenticated endpoints an orchestrator probes before any
credential exists: liveness, readiness and capabilities. A module registers
the dependencies it needs ready; the readiness answer is the conjunction.

## What it exports

`health.go`

- `Checker` — the port a dependency implements: `Name()` and `Check(ctx)`.
  `@oppenheimer/go-postgres` ships one for the database.
- `CheckerFunc` — adapts a function to `Checker`.
- `Module`, `New(version, capabilities)` — owns the routes; `Register(checker)`
  adds a readiness dependency, `Mount(router)` registers the routes on a
  router that carries no auth.

## How to use it

From the runner's composition root (`apps/runner/internal/server/server.go`):

```go
healthModule := health.New(cfg.Version, capabilities)
healthModule.Register(postgres.Checker{Pool: pool})
healthModule.Mount(public)
```

`capabilities` is the resolved feature set of the deployment, so a client can
ask the service what it can do before asking it to do it.

## How to run it

```bash
pnpm --filter @oppenheimer/go-health test
pnpm --filter @oppenheimer/go-health lint
```

## Depends on / used by

Depends on `@oppenheimer/go-httpx` (routing and JSON responses). Used by
`apps/runner`; `@oppenheimer/go-postgres` implements its `Checker`.
