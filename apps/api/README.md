# @oppenheimer/api

The NestJS REST API: authentication through Better Auth, organizations and
invitations, users and roles, profiles, API tokens, and the endpoints the
CLI and the MCP server drive. Every response error is an RFC 7807 problem
document; every endpoint carries Swagger decorators and a scope, from which
`@oppenheimer/api-client` is generated.

## Running it

```bash
pnpm docker:dev                       # Postgres + Redis
pnpm --filter @oppenheimer/api dev          # http://localhost:3001, Swagger at /docs
pnpm --filter @oppenheimer/api test
pnpm --filter @oppenheimer/api test:integration
pnpm --filter @oppenheimer/api arch         # dependency-cruiser boundaries
pnpm generate:api-client              # after an endpoint changes
```

Configuration is the root `.env`; `.env.example` documents every variable.

## Layout

One Domain-Driven Hexagon module per bounded context under `src/<module>/`:
`domain/`, `database/`, `commands/`, `queries/`, `dtos/`, a mapper and a
module file. [`ARCHITECTURE.md`](./ARCHITECTURE.md) is the layer model and the
"add a module" cookbook; `/scaffold-module` produces the skeleton.

## Depends on / used by

Depends on `@oppenheimer/shared`, `@oppenheimer/auth`, `@oppenheimer/backend-*` and
`@oppenheimer/backend-i18n` (with `@oppenheimer/translations`). Used by every app.
The control-plane link to `apps/runner` — the piece that would let it delegate
long-lived work there — does not exist yet; sessions are driven from the host
today (see `apps/runner/README.md`).

See [`AGENTS.md`](./AGENTS.md) for the conventions.
