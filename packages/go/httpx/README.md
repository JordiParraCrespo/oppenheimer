# @oppenheimer/go-httpx

The HTTP toolkit every Go adapter builds on: a router over the standard
library mux with middleware groups, a handler type that returns errors, JSON
helpers, the cross-cutting middleware chain and the server lifecycle. It stays
on `net/http` on purpose. Go 1.22 gave the mux method matching and path
parameters, so handlers remain plain `http.Handler`s testable with `httptest`
and compatible with any third-party middleware.

## What it exports

`router.go`

- `HandlerFunc` — `func(w, r) error`; the router renders the error as a
  problem document, so handlers never write error bodies.
- `Router`: `NewRouter(problems)`, `Use`, `Group`, `Handle`, `HandleFunc`,
  `Wrap`, `ServeHTTP`. Unmatched routes come back as 404/405 problems through
  the root middleware stack, not as the mux's plain text.
- `Middleware` and `Chain(h, mw...)` (first listed runs outermost).

`middleware.go`

- `RequestID()` (reads and echoes `RequestIDHeader`, `X-Request-Id`),
  `Recover(problems, logger)`, `Logger(logger)` (one access-log line per
  request), `MaxBytes(limit)`, `RealIP(hops)`, `SecurityHeaders()`,
  `ClientIP(r)`.

`json.go`

- `DecodeJSON(r, v)` rejects unknown fields, trailing data and oversized
  bodies with the right problem; `WriteJSON(w, status, v)`; `NoContent(w)`.

`server.go`

- `ServerOptions` and `Serve(ctx, logger, opts, handler, onShutdown...)`:
  listens until the context is cancelled, runs the hooks, then drains for
  `ShutdownTimeout`. No global write timeout, so WebSockets survive.

## How to use it

The composition root in `apps/runner/internal/server/server.go`:

```go
root := httpx.NewRouter(problems)
root.Use(
	httpx.RealIP(cfg.TrustProxy),
	httpx.RequestID(),
	httpx.Recover(problems, logger),
	httpx.Logger(logger),
	httpx.SecurityHeaders(),
	httpx.MaxBytes(cfg.MaxBodyBytes),
)
root.Group(func(api *httpx.Router) {
	api.Use(auth.Authenticate(problems, logger, verifiers...))
	jobsModule.Mount(api)
})
```

A handler in `apps/runner/internal/jobs/adapters/http` decodes, calls the
use case and returns whatever fails:

```go
func (h *Handler) submit(w http.ResponseWriter, r *http.Request) error {
	var in submitRequest
	if err := httpx.DecodeJSON(r, &in); err != nil {
		return err
	}
	// …
	return httpx.WriteJSON(w, http.StatusAccepted, body)
}
```

## How to run it

```bash
pnpm --filter @oppenheimer/go-httpx test    # go test -count=1 ./...
pnpm --filter @oppenheimer/go-httpx lint    # golangci-lint run ./...
pnpm --filter @oppenheimer/go-httpx build   # go build ./...
```

## Dependencies

Imports `@oppenheimer/go-core` (`core/problem`). Imported by `@oppenheimer/go-health`,
`@oppenheimer/go-auth`, `@oppenheimer/go-ws`, and in `apps/runner` by every HTTP adapter,
the composition root and `cmd/server/main.go` (`httpx.Serve`).
