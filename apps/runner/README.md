# @oppenheimer/runner

The host agent from `product/versions/mvp/02-runner.md`: one static Go
binary that will own the worktrees, the tmux sessions and the PTY stream on
a host you own. The NestJS API is the control plane; this service is the
thing that runs on the machine.

How it is installed on that machine and how it updates itself afterwards are
`product/versions/mvp/09-runner-install-and-update.md`.

**What works today**: a macOS, Debian or Ubuntu machine pairs with a
workspace, installs itself as a user service, keeps itself on the current
signed release (rolling back a version that will not stay up), and runs
sessions — a git worktree plus a tmux session with the agent in window 0,
tabs as further windows, a screen classifier for the sidebar dot, and a close
that pushes the branch and removes the worktree.

**What does not exist yet**: the outbound WebSocket to the control plane. So
sessions are driven from the host itself (`runner sessions …`) rather than
from a browser, and the git credential helper answers "I have none" because
the token it would hand git is minted by the control plane over that link.
Both are the next slice, in the order `apps/runner/ARCHITECTURE.md` lists.

`runner serve` and the `apikeys` context are the template this grew from:
an inbound API-key surface on a TCP port, which is what the container
image runs and what the API talks to today. **Nothing product-shaped
should be built on the key-minting endpoints** — pairing replaces them as
the way this host proves who it is, and they go when the link lands.

## Subcommands

| Command | What it does |
| ------- | ------------ |
| `runner run` | the host agent: single-instance lock, local 0600 Unix socket, update loop. What the service unit starts |
| `runner register --url … [--token-file F\|-] [--workspaces DIR] [--keep-existing] [--allow-container]` | redeems a one-hour registration token (from `--token-file`, `OPPENHEIMER_REGISTRATION_TOKEN` or `--token`): generates the host keypair, sends the public half with the host's facts, pins the control plane's fingerprint. Refuses a machine that looks temporary unless `--allow-container`; `--keep-existing` makes a re-run a repair |
| `runner workspaces [--set DIR]` | where sessions' checkouts live and why; `--set` moves it for new sessions, refused while a session still has a checkout |
| `runner install [--print]` | writes and starts the launchd agent (macOS) or systemd user unit (Debian, Ubuntu); `--print` shows the unit instead |
| `runner uninstall [--keep-identity] [--force]` | stops the service, revokes the host, erases the identity. Refuses while the runner's sessions run unless `--force`, which ends them (checkouts stay). Says when the control plane could not be told. Never touches the workspaces directory |
| `runner sessions ls\|create\|attach\|window\|restart\|close` | the worktree-plus-tmux lifecycle, from the host itself |
| `runner credential-helper get` | git's credential protocol, answered over the local socket |
| `runner status` | platform, pairing, service, tools, disk. Exits non-zero when the host is not ready |
| `runner update [--check\|--force\|--pin V\|--unpin\|--rollback]` | the update policy, by hand |
| `runner selfcheck` | what a staged binary must pass before it is allowed to become the service |
| `runner serve` | the control-plane-facing HTTP service on a TCP port — what the container image runs |

Exit codes are a public contract that scripts branch on: 0 ok, 1 failure,
2 usage, 3 auth, 4 forbidden, 5 not found, 6 unreachable.

## On a host

```
~/.oppenheimer/
  config.json   0600  host id, control plane, pinned fingerprint, channel
  host.key      0600  the Ed25519 key every dial is signed with
  bin/                runner-<version> binaries and the `current` symlink
  state/              update.json, sessions.json
  manifests/          agent detection rules newer than the bundled ones
  log/ run/           logs, the Unix socket, the single-instance lock
~/oppenheimer-ai/workspaces/<owner>/<repo>/main             the fetch source, never edited
~/oppenheimer-ai/workspaces/<owner>/<repo>/worktrees/<slug>  one per session
```

Sessions live in a tmux server on its own socket (`tmux -L oppenheimer`), so
the runner never collides with the user's own tmux and the server outlives
every runner restart, update and rollback. That is why the service units are
written to stop only the runner process.

## Releasing

```bash
scripts/runner/sign-release.sh --keygen release.key       # once, offline
RELEASE_PUBLIC_KEYS=<public key> scripts/runner/release.sh 1.2.3
scripts/runner/sign-release.sh dist/runner/stable.json release.key
```

The private key never touches CI. Every binary carries the public half, so a
runner verifies a manifest without asking anyone what to trust.

## What is in the box

| Concern           | Where                                      | How                                                                                      |
| ----------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Configuration     | `internal/config` on `packages/go/config`   | Root `.env` outside production, real env vars always win, required secrets fail boot     |
| Persistence       | `internal/*/adapters/postgres` on `packages/go/postgres` | Optional: `RUNNER_DATABASE_URL` swaps the in-memory key store for Postgres |
| Errors            | `packages/go/core/problem`                  | RFC 7807 `application/problem+json`, same members and `type` scheme as the NestJS API    |
| HTTP              | `packages/go/httpx`                         | `net/http` 1.22 routing, middleware groups, error-returning handlers, JSON helpers        |
| Authentication    | `packages/go/auth` + `internal/apikeys`     | API keys (`opr_…`, SHA-256 at rest) and HS256 service tokens; one `Principal` for both   |
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
  -d '{"name":"api","scopes":["events:read"]}' localhost:3006/v1/api-keys
```

The socket at `/v1/ws` takes the same bearer header on the upgrade. Send
`{"type":"subscribe","id":"1","topics":["hosts"]}` and every event a context
publishes on that topic arrives as
`{"type":"event","topic":"hosts","event":"host.online","payload":{…}}`. Every
topic needs `events:read`; a context that owns topics supplies its own
`ws.Authorizer` and the composition root chains it.

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
| `GET`    | `/v1/ws`                  | `events:read` per topic | Event stream                     |

Every failure is a problem document; the codes are listed on the docs site's
error reference under "Runner service".

## Credentials

- **Bootstrap key** — `RUNNER_BOOTSTRAP_API_KEY`. Holds every scope, exists
  before anything is issued. Use it once to mint real keys, then keep it in a
  vault.
- **API keys** — `opr_<id>_<secret>`. Only the SHA-256 hash is stored; the
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
