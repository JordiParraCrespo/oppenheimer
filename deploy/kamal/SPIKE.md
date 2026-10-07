# Spike: Kamal for the dev deployment

Question: should `deploy/dev`'s own deploy engine (`oppctl deploy`, `rollback`,
the release directories and the compose invariants) be replaced by
[Kamal](https://kamal-deploy.org)?

**Answer: yes, for deploying and rolling back. Keep our backup pipeline.**
Kamal 2.12 handles everything this setup needs: no published ports, images
built by CI, the internal database network, `/api` routing and WebSockets.
Unlike `oppctl`, its deploys have no downtime and a failed deploy never takes
the site down. The costs:

- a less contained CI credential
- secrets moving into GitHub
- the backup tooling no longer running under compose

## What was run

Kamal 2.12.0 (kamal-proxy v0.9.2), deploying over SSH to a Docker host. The
images were stand-ins pushed to a local registry, as in the PR's own tests:
an nginx-based API, an API that takes 15 s to boot, a broken API answering
500, and a Node API with a raw WebSocket echo at `/api/v1/relay/attach`. The
configs in this directory are what ran, apart from the hosts, registry and
user, which come from the environment.

| Check | Result |
|---|---|
| `kamal setup` from nothing | Postgres, Redis, cloudflared, kamal-proxy and the API up in 15 s |
| kamal-proxy with `publish: false` | `docker port kamal-proxy` is empty: nothing on the host |
| Internal network | Postgres and Redis only on `oppenheimer-data` (`--internal`); Postgres cannot resolve the internet. The API is on `kamal` and `oppenheimer-data` |
| Routing on one host | `/` and SPA paths → web, `/api/*` → API (prefix kept), unknown host → 404 |
| Deploy, API booting for 15 s, probed every 200 ms | **0 of 120** requests failed |
| Same rollout with `docker compose up -d` (what `oppctl` does) | **76 of 107** failed: about a 15 s outage |
| Deploy of an API that answers 500 | `kamal deploy` exits 1 after the health timeout; **0 of 896** requests failed, the old container kept serving |
| `kamal rollback <version>` | 13 s, 0 of 76 failed |
| WebSocket through kamal-proxy, idle 45 s (past the 30 s response timeout) | Echo arrives; the connection is not cut |
| `X-Forwarded-For` at the API | `client, cloudflared`, from peer kamal-proxy, so `TRUST_PROXY=2` gives the client address |

Not run here, and still to prove on the server:
- cloudflared actually connecting (it boots as an accessory, but there is no
  tunnel in the sandbox)
- the real API and web images
- what open terminals see during a deploy: Kamal drains the old API for up
  to `drain_timeout` (30 s), then stops it, so attached sockets reconnect
  once per deploy

## How the dev deployment maps onto Kamal

| Today (`deploy/dev`) | With Kamal |
|---|---|
| `compose.yml` | `deploy.api.yml` (API and its accessories: Postgres, Redis, cloudflared) and `deploy.web.yml` |
| `oppctl deploy`: pull, digest pin, verify, roll back | `kamal deploy --skip-push --version <sha>` for each app. The proxy health-checks and switches. Images are pulled by their `:<sha>` tag, which only the workflow pushes, not pinned by digest |
| `oppctl rollback`, `current`/`previous` | `kamal rollback <sha>`. Kamal keeps the last `retain_containers` releases |
| Deploy gate: forced command, `deploy <sha>` only | **Gone.** Kamal drives Docker over SSH with a full shell (see below) |
| nginx in the web image proxies `/api` | kamal-proxy routes `/api` straight to the API. The web image's nginx still needs a resolvable upstream at start, so `API_UPSTREAM=kamal-proxy:80` |
| `data` network, `internal: true` | `oppenheimer-data` network, created by the `docker-setup` hook. Accessories use `network:`, and the API joins it via role `options` |
| Compose invariants (`check_invariants`) | Mostly by construction: Kamal publishes nothing it isn't told to. Accessory images are pinned by digest in the config, and app images by sha |
| `config/api.env` on the server | `env.secret` in the config, values from `deploy/kamal/secrets`, which reads them from the CI job's environment. Kamal writes them to a 0600 env file on the server at each deploy |
| Backups: `oppctl backup` via compose, systemd timers | **Unchanged in purpose**, but `oppctl backup`/`restore` must use `docker run` against `oppenheimer-data` instead of compose. Kamal's `pre-deploy` hook runs the dump over SSH before each deploy |

## What it costs

1. **The CI credential is no longer narrow.** Kamal runs arbitrary
   `docker` commands over SSH, so CI's key must be a full login in the
   docker group: root-equivalent on the server. Today the gate limits it to
   `deploy <sha>`, although the compose file a deploy carries could do
   nearly as much. What still holds:
   - the workflow only runs on `main`
   - the `dev` environment's branch rule
   - the tailnet ACL (`tag:ci` → port 22 only)

   Tailscale SSH would remove the key altogether.
2. **Secrets live in GitHub instead of on the server.** Every app secret
   becomes an environment secret in GitHub (or one of Kamal's secret
   adapters, such as 1Password or Bitwarden). Rotating one means
   redeploying. That is arguably better (one source of truth, audit log),
   but it is a move.
3. **Accessories are not deployed.** Bumping Postgres, Redis or cloudflared
   is `kamal accessory reboot <name>`, a manual step with downtime for that
   service. It is the same today, where compose recreates them on `up`, but
   now it is explicit.
4. **Images need a `service` label.** Kamal refuses an image without
   `service=<name>` (found here). The CI build adds it with
   `labels: service=oppenheimer-<app>`.
5. **The workflow gains Ruby.** A `ruby/setup-ruby` step and `gem install
   kamal -v 2.12.0`, or the `ghcr.io/basecamp/kamal` image.
6. **Two apps deploy separately.** The API and web deploy one after the
   other, so for a moment the new API serves the old console, or the
   reverse. The same skew exists today between nginx starting and the API.
7. **Migrations still run at boot.** Zero downtime means the old API keeps
   serving while the new one migrates. Every migration must stay compatible
   with the previous release (expand, then contract), which was already the
   rule.

## Recommendation

Adopt Kamal for deploy and rollback, in a follow-up to the PR that adds
`deploy/dev`, not on top of it unverified:

1. Add the `service` label to the image builds. Replace the deploy job's SSH
   to the gate with `kamal deploy` for the API, then web, and add a
   `pre-deploy` hook that runs the encrypted dump on the server.
2. Port `oppctl backup`, `restore` and `doctor` from compose to `docker run`
   on `oppenheimer-data`. Delete `oppctl deploy`/`rollback`, the gate,
   releases and `compose.yml`.
3. Prove it on the real server once: the tunnel connects, the real images
   boot, a terminal reconnects across a deploy, and a broken deploy keeps
   serving.

If the narrow CI credential matters more than zero-downtime deploys, keep
`oppctl` and swap only `compose up` for
[docker-rollout](https://github.com/Wowu/docker-rollout). That fixes the
outage without the rest of Kamal.
