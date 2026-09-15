# @oppenheimer/runner

A Go service for the parts of the platform NestJS is the wrong tool for:
long-lived connections, process or container orchestration, anything where a
static binary with no runtime and tight control over the network matters.
The NestJS API stays the product backend; this service is what the API calls
when it needs a runner, a VM or a container done.

It is a **template with a working example**: the `jobs` context submits work
to a worker pool and streams its progress over WebSocket. Replace the runners
with real ones, or the whole context with yours, and keep the shell.

## What is in the box

| Concern           | Where                                      | How                                                                                      |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Configuration     | `internal/config` on `packages/go/config`   | Root `.env` outside production, real env vars always win, required secrets fail boot     |
| Persistence       | `internal/*/adapters/postgres` on `packages/go/postgres` | Optional: `RUNNER_DATABASE_URL` swaps the in-memory stores for Postgres (keys, jobs); on restart, persisted queued jobs re-run and interrupted running jobs fail |
| Errors            | `packages/go/core/problem`                  | RFC 7807 `application/problem+json`, same members and `type` scheme as the NestJS API    |
| HTTP              | `packages/go/httpx`                         | `net/http` 1.22 routing, middleware groups, error-returning handlers, JSON helpers        |
| Authentication    | `packages/go/auth` + `internal/apikeys`     | API keys (`flr_…`, SHA-256 at rest) and HS256 service tokens; one `Principal` for both   |
| Authorization     | `internal/scopes` on `packages/go/auth/scope` | This service's `resource:read|write` catalog; `write` implies `read`                   |
| WebSocket         | `packages/go/ws`                            | Hub with topic subscriptions, backpressure, ping keepalive, graceful going-away          |
| Health            | `packages/go/health`                        | `/healthz`, `/readyz` with registered checkers, `/health/capabilities`                   |
| Logging           | `packages/go/core/logging`                  | `slog`, JSON in production, one access-log line per request with the correlation id     |
| Architecture test | `internal/arch`                            | Fails the build when an import crosses a hexagon boundary                                |

The cross-cutting rows are shared modules under `packages/go/` (see its
README); this app owns only its config, its scope catalog, its bounded
contexts and the composition root.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the layer model and the "add a
context" cookbook.

## Run it

```bash
# From the repo root. RUNNER_BOOTSTRAP_API_KEY must be set in the root .env.
pnpm --filter @oppenheimer/runner dev
# or, inside apps/runner
make dev
```

```bash
export KEY=$RUNNER_BOOTSTRAP_API_KEY   # the value from .env

curl -s localhost:3006/healthz
curl -s -H "Authorization: Bearer $KEY" localhost:3006/v1/me

# Mint a narrower key for the NestJS API
curl -s -X POST -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"name":"api","scopes":["jobs:write","events:read"]}' localhost:3006/v1/api-keys

# Submit a job and watch it over WebSocket
curl -s -X POST -H "Authorization: Bearer $KEY" -H 'Content-Type: application/json' \
  -d '{"kind":"sleep","payload":{"durationMs":3000}}' localhost:3006/v1/jobs
```

The socket at `/v1/ws` takes the same bearer header on the upgrade. Send
`{"type":"subscribe","id":"1","topics":["jobs"]}` and every job event arrives
as `{"type":"event","topic":"jobs","event":"job.started","payload":{…}}`.
Subscribe to `jobs/<id>` for one job only.

## Endpoints

| Method   | Path                      | Scope        | Purpose                                     |
| -------- | ------------------------- | ------------ | ------------------------------------------- |
| `GET`    | `/healthz`, `/readyz`     | none         | Liveness and readiness                      |
| `GET`    | `/health/capabilities`    | none         | Optional features this deployment has on    |
| `GET`    | `/v1/me`                  | any          | The caller's principal and scopes           |
| `POST`   | `/v1/api-keys`            | `keys:write` | Mint a key (scopes ⊆ caller's)              |
| `GET`    | `/v1/api-keys[/{id}]`     | `keys:read`  | Key metadata, never the secret              |
| `DELETE` | `/v1/api-keys/{id}`       | `keys:write` | Revoke immediately                          |
| `POST`   | `/v1/service-tokens`      | `keys:write` | Mint a short-lived JWT for an agent         |
| `POST`   | `/v1/jobs`                | `jobs:write` | Submit; `202` + `Location`, `429` when full |
| `GET`    | `/v1/jobs[/{id}]`         | `jobs:read`  | List (`?status=&limit=`) and fetch          |
| `POST`   | `/v1/jobs/{id}/cancel`    | `jobs:write` | Cancel queued or running                    |
| `GET`    | `/v1/ws`                  | `events:read` per topic | Event stream                     |

Every failure is a problem document; the codes are listed on the docs site's
error reference under "Runner service".

## Credentials

- **Bootstrap key** — `RUNNER_BOOTSTRAP_API_KEY`. Holds every scope, exists
  before anything is issued. Use it once to mint real keys, then keep it in a
  vault.
- **API keys** — `flr_<id>_<secret>`. Only the SHA-256 hash is stored; the
  plaintext is shown once at creation. A key can never carry a scope its
  creator lacks.
- **Service tokens** — HS256 JWTs, on only when `RUNNER_JWT_SECRET` is set
  (`/health/capabilities` lists `service_tokens`). Meant for agents this
  service bootstraps: short TTL, scopes ⊆ the minter's.

The keys live in memory by default. `internal/apikeys/app.Repository` is the
port to implement for Postgres or SQLite; the module takes it as an option.

## Configuration

All variables are documented in the root `.env.example` under "Runner
(apps/runner)". Only `RUNNER_BOOTSTRAP_API_KEY` is required.

## Docker

```bash
docker build -f apps/runner/Dockerfile -t oppenheimer-runner .
docker run --rm -p 3006:3006 -e RUNNER_BOOTSTRAP_API_KEY=… oppenheimer-runner
```

Static binary on a distroless base, non-root, ~10 MB.
