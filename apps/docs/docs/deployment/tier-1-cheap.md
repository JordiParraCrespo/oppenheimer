---
sidebar_position: 1
---

# Tier 1: Low-Cost Deployment (~€4/mo)

For personal projects and MVPs.

## Architecture

| App              | Where                                 | Cost   |
| ---------------- | ------------------------------------- | ------ |
| Web              | Vercel / Cloudflare Pages (free tier) | €0     |
| API + DB + Redis | Hetzner CX22 VPS                      | ~€4/mo |
| Docs             | Cloudflare Pages / GitHub Pages       | €0     |

## Setup

### 1. Provision a Hetzner VPS

Create a CX22 (2 vCPU, 4GB RAM) on Hetzner Cloud.

### 2. Deploy API with Docker Compose

The stack reads its settings from one `.env` at the root of the checkout, the
same file development uses. Its variables are documented in the root
`.env.example`.

```bash
# On the VPS, from the root of the checkout
cp .env.example .env
# Edit .env. At minimum: BETTER_AUTH_SECRET, BETTER_AUTH_URL and FRONTEND_URL
# (the public URLs), DB_PASSWORD, and the *_IMAGE tags CI pushed.
pnpm docker:prod        # docker compose --env-file .env -f docker/docker-compose.prod.yml up -d
```

Without `pnpm`, run the command in the comment. Keep the `--env-file .env`:
Compose otherwise looks for a `.env` beside the compose file, in `docker/`,
and the image, database and runner values interpolate blank. The `api` service
loads the whole file as its environment, so an optional feature (host pairing,
the GitHub App, email delivery, OAuth) turns on by setting its variables there
and restarting. `DB_HOST` and `REDIS_HOST` in `.env` are ignored inside the
stack: the compose file points the API at its own `postgres` and `redis`
services.

`pnpm docker:prod:down` stops the stack and keeps its volumes.

#### Database connections

Each API replica opens two Postgres pools: TypeORM's for the API's own queries
(`DB_POOL_MAX`, 10 by default) and Better Auth's for sign-in, session lookups
and the auth rate limiter (`DB_AUTH_POOL_MAX`, 5). Boot migrations briefly
open one more connection of their own. Size them so the whole deployment fits
under Postgres's limit:

```
replicas × (DB_POOL_MAX + DB_AUTH_POOL_MAX)
  + 1                    (the boot migrator, while a replica starts)
  + ~5                   (psql, backups, the seed)
  ≤ max_connections − superuser_reserved_connections
```

Postgres 16 defaults to `max_connections = 100` with 3 reserved for
superusers, so at the default 15 per replica six replicas fit comfortably.
Raise the pool sizes when requests queue for a connection (they fail with
"timeout exceeded when trying to connect" after `DB_CONNECTION_TIMEOUT_MS`)
while Postgres itself has headroom. When the sum no longer fits, add PgBouncer
in front of Postgres rather than raising `max_connections` much further: each
Postgres connection is a process with its own memory.

PgBouncer in transaction mode rejects the startup parameters the pools send
(`statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`)
unless they are listed in its `ignore_startup_parameters`. Listed there they
are silently dropped, so set them on the database or role instead
(`ALTER ROLE … SET statement_timeout = '15s'`).

The timeouts make a stuck query fail instead of hanging every request behind
it. Each one surfaces in the API log as a failed query with its SQLSTATE, and
to the client as a 500 with a correlation id:

| SQLSTATE | Cause                                       | Variable                            |
| -------- | ------------------------------------------- | ----------------------------------- |
| `57014`  | a statement ran past the statement timeout  | `DB_STATEMENT_TIMEOUT_MS` (15 s)    |
| `55P03`  | a statement waited too long for a lock      | `DB_LOCK_TIMEOUT_MS` (5 s)          |
| `25P03`  | a transaction sat idle and was ended        | `DB_IDLE_IN_TRANSACTION_TIMEOUT_MS` (30 s) |

Boot migrations are exempt from the statement and lock timeouts: they run on
their own connection, and a migration that needs a lock timeout sets one
itself. In `pg_stat_activity` the connections are named by
`application_name`: `api` (TypeORM), `api-auth` (Better Auth) and
`api-migrations` (the boot migrator):

```sql
SELECT application_name, state, count(*) FROM pg_stat_activity GROUP BY 1, 2;
```

### 3. Deploy Web

Connect your repo to Vercel or Cloudflare Pages. Set the root directory to `apps/web`.

### 4. Deploy Docs

Connect your repo to Cloudflare Pages. Set the root directory to `apps/docs`.
