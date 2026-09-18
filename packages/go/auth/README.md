# @oppenheimer/go-auth

Who is calling, and what may they do. `auth` turns a bearer credential into a
`Principal` on the request context and gates routes on the scopes that
principal holds. It is the Go counterpart of the API's `ScopesGuard`: the same
scope catalog, the same problem documents, so a client that understands one
service understands the other.

## What it exports

`principal.go`

- `Principal` — who authenticated: `Kind` (`KindUser`, `KindAPIKey`), the
  subject, the granted `scope.Set`.
- `WithPrincipal(ctx, p)` / `FromContext(ctx)` — the principal travels on the
  request context; handlers read it, never a header.

`middleware.go`

- `Verifier` — a port: anything that can turn a credential string into a
  `Principal`. The runner binds a JWT verifier and an API-key verifier.
- `Authenticate(problems, logger, verifiers...)` — an `httpx.Middleware` that
  tries each verifier and answers `401` as a problem document when none
  accepts the credential.
- `RequireScopes(problems, required...)` — an `httpx.Middleware` that answers
  `403` unless the principal holds every scope; write implies read.

`jwt.go`

- `JWT`, `NewJWT(JWTOptions)`, `Claims` — HS256 tokens the API mints for the
  runner, checked for issuer, audience and expiry.

`errors.go`

- `ErrInvalidCredential` — what a verifier returns for a credential it
  recognises but rejects.

`scope/`

- `Scope`, `Catalog`, `NewCatalog`, `Set`, `NewSet`, `ParseSet`, `Join` — the
  scope vocabulary and the set algebra `RequireScopes` evaluates.

## How to use it

The composition root builds the verifiers and mounts the middleware once; a
module then declares what each route group needs (from
`apps/runner/internal/server/server.go` and
`apps/runner/internal/apikeys/adapters/http/handler.go`):

```go
j, err := auth.NewJWT(auth.JWTOptions{Secret: cfg.JWT.Secret, Issuer: cfg.JWT.Issuer, Audience: cfg.JWT.Audience})
api.Use(auth.Authenticate(problems, logger, verifiers...))

g.Use(auth.RequireScopes(h.problems, scopes.KeysRead))
```

A handler that needs the caller reads `auth.FromContext(r.Context())`.

## How to run it

```bash
pnpm --filter @oppenheimer/go-auth test    # go test -count=1 ./...
pnpm --filter @oppenheimer/go-auth lint    # golangci-lint run ./...
```

## Depends on / used by

Depends on `@oppenheimer/go-core` (problem documents) and `@oppenheimer/go-httpx`
(the `Middleware` type). Used by `apps/runner` and by `@oppenheimer/go-ws`, whose
handler authorises a subscription against the principal.
