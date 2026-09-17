# @oppenheimer/go-auth — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first, then
> [`packages/go/README.md`](../README.md) for how the Go modules fit
> together and [`apps/runner/ARCHITECTURE.md`](../../../apps/runner/ARCHITECTURE.md)
> for the hexagon they serve.

## Where things go

- A new credential type is a `Verifier` in a new file, bound in the runner's composition root; `Authenticate` does not change.
- A new scope is a `scope.Scope` declared in the service's catalog (`apps/runner/internal/scopes`), never a string in a handler.
- Anything a second service would copy belongs here; anything one service
  owns stays in that service under `internal/`.

## Before pushing

```bash
pnpm --filter @oppenheimer/go-auth lint    # golangci-lint run ./...
pnpm --filter @oppenheimer/go-auth test    # go test -count=1 ./...
pnpm --filter @oppenheimer/runner arch   # the runner's boundary test still passes
```

## Patterns agents get wrong

- Importing another module's internals instead of its exported type. The
  modules depend on each other only through what they export: `core` under
  everything, `auth` on `core` and `httpx`, `ws` on `auth`.
- Hand-writing a JSON error body. Every failure is an RFC 7807 problem
  document from `core/problem`, rendered by the `httpx` router.
- Reaching for a framework. Standard `net/http`, `slog`, interfaces as
  ports and constructor injection are the whole toolkit.

See [`.agents/rules/go.md`](../../../.agents/rules/go.md).
