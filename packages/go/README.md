# packages/go — shared Go modules

The Go counterpart of `packages/backend/*`: reusable modules every Go
service in the monorepo builds on, each an interface plus implementations
plus a constructor the service selects by config. One `go.work` at the repo
root ties them together; each module also carries relative `replace`
directives so it stays buildable and tidy-able on its own.

| Module       | npm name           | Purpose                                                                          |
| ------------ | ------------------ | -------------------------------------------------------------------------------- |
| `core`       | `@oppenheimer/go-core`   | `problem`: RFC 7807 documents mirroring the API's; `logging`: slog setup         |
| `config`     | `@oppenheimer/go-config` | Root `.env` loader mirroring `@oppenheimer/env`; typed accessors that collect errors   |
| `httpx`      | `@oppenheimer/go-httpx`  | `net/http` router with middleware groups, error-returning handlers, JSON, server |
| `health`     | `@oppenheimer/go-health` | `/healthz`, `/readyz` with registered checkers, `/health/capabilities`           |
| `auth`       | `@oppenheimer/go-auth`   | Bearer middleware, `Principal`, scope grammar and guard, HS256 service tokens    |
| `ws`         | `@oppenheimer/go-ws`     | WebSocket hub: topics, backpressure, keepalive, graceful going-away              |
| `postgres`   | `@oppenheimer/go-postgres` | Pooled `pgx` connection, forward-only SQL migrator (advisory-locked), readiness checker |
| `selfupdate` | `@oppenheimer/go-selfupdate` | Signed release manifests, digest-checked downloads, atomic versioned binary swaps |

Dependency flow: `core` ← `httpx` ← `health`, `auth` ← `ws`; `config`,
`postgres` and `selfupdate` stand alone. A module never imports an app.

## How Turborepo sees them

Every module has a `package.json` naming it `@oppenheimer/go-<module>` with
`build`, `lint` and `test` scripts that call `go` directly, and declares the
modules it imports as `workspace:*` devDependencies. That declaration is
what gives Turborepo the graph: `apps/runner` lists all of them, so
`turbo run build --filter=@oppenheimer/runner` builds them first, `--affected`
re-runs dependents when a module changes, and a change in `core`
invalidates the cache of everything above it while `config` stays cached.
The per-package `turbo.json` adds `go.work` (and `.golangci.yml` for lint)
to the hashed inputs, since adding a module changes what `./...` resolves
to. Library builds produce no files; only the runner's `dist/**` is cached.

## Commands

```bash
pnpm turbo run build test --filter='./packages/go/*'   # through Turborepo
make -C packages/go test                               # whole workspace, from go.work
make -C packages/go tidy                               # go mod tidy for every module
```

The repo root is not a module, so `./...` does not resolve there. Use the
module-path pattern (`go test github.com/jordiparracrespo/oppenheimer/...`) or
the Makefile, which derives directory patterns from `go list -m`.

## Adding a module

1. `packages/go/<name>/go.mod` with the module path
   `github.com/jordiparracrespo/oppenheimer/packages/go/<name>`, plus a
   `require` and a relative `replace` for every sibling it imports, transitively.
2. Add it to `use (...)` in the root `go.work`.
3. `package.json` named `@oppenheimer/go-<name>` with the three scripts and the
   sibling modules as `workspace:*` devDependencies; copy a sibling's
   `turbo.json`.
4. `pnpm install` to refresh the lockfile.
5. Consumers add the module to their `go.mod` (require + replace) and to
   their `package.json` devDependencies. `apps/runner/internal/arch` decides
   which layers of a service may import it.

Rules for the code itself are in `.agents/rules/go.md`.
