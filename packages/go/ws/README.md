# @oppenheimer/go-ws

Topic-based WebSocket fan-out for Go services. One `Hub` serves every
connection; a module publishes events to a topic and an authorised subscriber
receives them as `Envelope` frames. The runner uses it to stream job progress
to the API.

## What it exports

`envelope.go`

- `Envelope` — the frame every message uses: `type`, `topic`, `payload`, and
  an `ErrorBody` when the server refuses something.

`hub.go`

- `Hub`, `NewHub(logger, Options)`, `DefaultOptions()` — the registry of
  connections and subscriptions; `Publish(topic, event, payload)` fans out,
  `Shutdown(ctx)` closes every connection with a going-away frame.

`handler.go`

- `Authorizer` — `func(ctx, *auth.Principal, topic) error`: a module decides
  who may subscribe to what.
- `Handler(hub, problems, logger, authorize)` — the `http.Handler` that
  upgrades a request, refuses an unauthenticated one as a problem document,
  and runs the subscribe/unsubscribe loop for the connection.

`conn.go` — one connection's write pump and close semantics; not exported.

## How to use it

From the composition root (`apps/runner/internal/server/server.go`):

```go
hub := ws.NewHub(logger.With(slog.String("module", "ws")), ws.DefaultOptions())
api.Handle("GET /v1/ws", ws.Handler(hub, problems, logger, authorizeEvents))
```

`authorizeEvents` checks the principal's scopes against the topic — every topic
currently needs `events:read`, until a product context (sessions, hosts) owns
topics of its own and supplies its own `ws.Authorizer`. A use case then calls
`hub.Publish` when something changes.

## How to run it

```bash
pnpm --filter @oppenheimer/go-ws test
pnpm --filter @oppenheimer/go-ws lint
```

## Depends on / used by

Depends on `@oppenheimer/go-core` (problem documents) and `@oppenheimer/go-auth` (the
principal). Used by `apps/runner`.
