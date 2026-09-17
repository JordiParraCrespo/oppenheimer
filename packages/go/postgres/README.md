# @oppenheimer/go-postgres

The shared Postgres toolkit for Go services: a pooled connection that has
proven it can reach the database, forward-only SQL migrations, and a readiness
checker for `@oppenheimer/go-health`.

## What it exports

`postgres.go`

- `Open(ctx, url, Options)` — parses the URL, applies the pool options
  (`Options` zero values are conservative defaults) and pings before
  returning a `*pgxpool.Pool`.
- `Checker{Pool, Timeout}` — a `health.Checker` that pings within `Timeout`.

`migrate.go`

- `Migrate(ctx, pool, namespace, files)` — applies every `*.sql` in `files`
  (an `fs.FS`, usually an `embed.FS`) in filename order, recording each under
  `namespace` so two services can share a database without sharing a
  migrations table. Forward-only: no down migrations, no checksums.

## How to use it

From the runner's composition root:

```go
pool, err := postgres.Open(ctx, cfg.DatabaseURL, postgres.Options{})
if err := postgres.Migrate(ctx, pool, "runner", migrations.Files); err != nil { … }
healthModule.Register(postgres.Checker{Pool: pool})
```

Repositories take the pool in their constructor; nothing else in a service
imports `pgx` directly.

## How to run it

```bash
pnpm --filter @oppenheimer/go-postgres test
pnpm --filter @oppenheimer/go-postgres lint
```

## Depends on / used by

Depends on `pgx` and `@oppenheimer/go-health` (the `Checker` interface). Used by
`apps/runner`'s repositories and composition root.
