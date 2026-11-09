# Monitoring

The API's Prometheus alert rules and Grafana dashboards, kept here as the
source of truth. Nothing on the dev server runs Prometheus or Loki yet; on a
development machine, `pnpm monitoring:up` runs Prometheus with these rules,
Loki with Alloy shipping the API's log file to it, and a Grafana with these
dashboards over both (below).

| File | What it is |
|---|---|
| `prometheus/api.rules.yaml` | Alerts: availability, 5xx and latency by route, event-loop lag and heap, outbox and queue backlog, the backlog sampler's own health, bot turns failing, the bots' prompt cache gone cold, cache reads failing |
| `grafana/api.json` | The API dashboard: traffic, latency, backlog, process. Provisioned by the local Grafana; elsewhere, import it and pick the Prometheus data source |
| `grafana/bots.json` | The bots and cache dashboard: engine runs and how they ended, failures by kind, tokens, the prompt cache hit rate, run duration, tools and retries; the Redis cache's hit rate by namespace; log lines by level and the latest errors (Loki) |

What each metric means, and how the API exports it (`METRICS_TOKEN`, HTTP
Basic auth on `GET /api/v1/metrics`), is
[`apps/docs/docs/deployment/monitoring.md`](../../../apps/docs/docs/deployment/monitoring.md).

## Running it locally

`docker/docker-compose.monitoring.yml` is a Prometheus that scrapes the API
`pnpm dev` runs on the host and loads every `*.rules.yaml` in `prometheus/`
here, so the rules are evaluated against real series before they reach a
server, and a Grafana that shows every dashboard in `grafana/` here:

1. Set `METRICS_TOKEN` in the root `.env` or `.env.local` (`openssl rand
   -hex 32`) and, for the logs, `LOG_FILE=.logs/api.log`, then restart the
   API; without the token `/api/v1/metrics` is a 404, without the file
   Loki gets nothing.
2. `pnpm monitoring:up`, then `http://localhost:3030`: Grafana opens on the
   API dashboard, signed in as an admin with no login (it listens on
   loopback only); the bots dashboard is beside it in the Oppenheimer
   folder. Prometheus is `http://localhost:9090`: Status → Targets shows
   `oppenheimer-api` up, Alerts shows the rules. Loki is
   `http://localhost:3100`, read with `pnpm logs` (LogQL, see
   `apps/docs/docs/deployment/monitoring.md`, "Logs") or Grafana's Explore.
3. After editing a rule, `curl -X POST localhost:9090/-/reload` re-reads it
   (an edit to `prometheus.yml` needs `pnpm monitoring:down` and `up`).
   An edit to a dashboard's JSON shows in Grafana within 10 seconds; the
   provisioned dashboards refuse saving from the UI, so change the file
   (or export the edited dashboard's JSON over it).
   `pnpm monitoring:down` stops them all; `docker compose -f
   docker/docker-compose.monitoring.yml down -v` also drops the 7 days of
   metrics and logs and Grafana's own state. The API's `.logs/api.log` is
   never rotated: delete it to reclaim the space (Alloy picks the new one
   up).

Its config is `docker/monitoring/prometheus.yml`, the one definition of the
API's scrape job: target `host.docker.internal:3001` (or the `PORT` the API
listens on), the token handed in as a compose secret. The scripts read
`.env` and `.env.local` the way the API does. With `METRICS_TOKEN` empty the
container refuses to start and says why. Grafana's provisioning is
`docker/monitoring/grafana/`: the Prometheus data source as the default (the
dashboards' `DS_PROMETHEUS` resolves to it), the Loki one (`DS_LOKI`) and a
file provider over `grafana/` here. Loki's config is
`docker/monitoring/loki/loki.yaml` (one process, filesystem storage, 7 days);
Alloy's is `docker/monitoring/alloy/config.alloy`, which tails
`.logs/*.log`, labels each line `app` (the file's name) and `level`, and
keeps the correlation id and the logger's context as structured metadata.
The script creates `.logs/` before `up`, so the directory Alloy mounts is
yours and the API can write in it.

## Scraping the dev server

No container publishes a port, so the scraper joins the compose `edge`
network (or the tailnet) and reaches the API at `api:3001`, not through the
public origin. The scrape job is the `oppenheimer-api` job in
`docker/monitoring/prometheus.yml` with two changes: the target is
`api:3001`, and `password_file` is wherever that Prometheus keeps the token
(say `/etc/prometheus/oppenheimer-metrics-token`). `rule_files` points at
this directory's `prometheus/*.rules.yaml`, and `config/api.env` on the server sets `METRICS_TOKEN` (`openssl rand -hex 32`).

## Keeping them honest

`apps/api/src/__tests__/monitoring-config.spec.ts` parses the rules and every
dashboard and fails when a rule or a panel names a metric the API does not
export (Loki panels, which name streams, are skipped), or a rule lacks
a severity or a summary. CI has no `promtool`, so the PromQL itself is not
type-checked there; the local Prometheus image carries one:

```bash
docker run --rm -v "$PWD/deploy/dev/monitoring/prometheus:/rules:ro" \
  --entrypoint promtool quay.io/prometheus/prometheus:v3.5.0 \
  check rules /rules/api.rules.yaml
```

`promtool test rules` (unit tests for the alerts) is the next step. The Loki
and Alloy configs have no check in CI either; Alloy's formatter parses one, which catches a syntax error:

```bash
docker run --rm -v "$PWD/docker/monitoring/alloy:/etc/alloy:ro" \
  grafana/alloy:v1.10.2 fmt /etc/alloy/config.alloy
```
