# @oppenheimer/runner — Agent Instructions

Go service template. Read the root [`CLAUDE.md`](../../CLAUDE.md) first, then
[`ARCHITECTURE.md`](./ARCHITECTURE.md) here. The rules for this app live in
`.agents/rules/go.md`.

## Stack

- Go 1.24, standard `net/http` routing (method + path params), no framework
- The cross-cutting toolkit is `packages/go/*` (problem+json, httpx, auth,
  ws, health, config) — one Go module each, tied together by the root
  `go.work`. Fix a shared concern there, not here; this app owns its config,
  scope catalog, bounded contexts and composition root
- `log/slog` for logging, `coder/websocket` for the socket, `golang-jwt/v5`
  for service tokens. Add a dependency only when the standard library cannot
  do the job
- `golangci-lint` (config in the root `.golangci.yml`); `pnpm test` runs the suite
  and the import-boundary test in `internal/arch`. `make test-race` runs it
  under the race detector, which CI cannot (no C compiler on the runners),
  so run it locally before pushing concurrent code

## Commands

```bash
make dev                     # run with the root .env
make test                    # this module; CI runs the whole workspace
make -C ../../packages/go test   # every Go module in go.work
make test-race               # run locally for anything concurrent
make -C ../../packages/go lint   # golangci-lint across the workspace
```
