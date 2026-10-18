# Monitoring

The API's Prometheus alert rules and Grafana dashboard, kept here as the
source of truth. Nothing on the dev server runs Prometheus yet; on a
development machine, `pnpm monitoring:up` runs one with these rules and a
Grafana with this dashboard (below).

| File | What it is |
|---|---|
| `prometheus/api.rules.yaml` | Alerts: availability, 5xx and latency by route, event-loop lag and heap, outbox and queue backlog, and the backlog sampler's own health |
| `grafana/api.json` | The dashboard: traffic, latency, backlog, process. Provisioned by the local Grafana; elsewhere, import it and pick the Prometheus data source |

What each metric means, and how the API exports it (`METRICS_TOKEN`, HTTP
Basic auth on `GET /api/v1/metrics`), is
[`apps/docs/docs/deployment/monitoring.md`](../../../apps/docs/docs/deployment/monitoring.md).

## Running it locally

`docker/docker-compose.monitoring.yml` is a Prometheus that scrapes the API
`pnpm dev` runs on the host and loads every `*.rules.yaml` in `prometheus/`
here, so the rules are evaluated against real series before they reach a
server, and a Grafana that shows every dashboard in `grafana/` here:

1. Set `METRICS_TOKEN` in the root `.env` or `.env.local` (`openssl rand
   -hex 32`) and restart the API; without it `/api/v1/metrics` is a 404.
2. `pnpm monitoring:up`, then `http://localhost:3030`: Grafana opens on the
   API dashboard, signed in as an admin with no login (it listens on
   loopback only). Prometheus is `http://localhost:9090`: Status → Targets
   shows `oppenheimer-api` up, Alerts shows the rules.
3. After editing a rule, `curl -X POST localhost:9090/-/reload` re-reads it
   (an edit to `prometheus.yml` needs `pnpm monitoring:down` and `up`).
   An edit to a dashboard's JSON shows in Grafana within 10 seconds; the
   provisioned dashboards refuse saving from the UI, so change the file
   (or export the edited dashboard's JSON over it).
   `pnpm monitoring:down` stops both; `docker compose -f
   docker/docker-compose.monitoring.yml down -v` also drops the 7 days of
   metrics and Grafana's own state.

Its config is `docker/monitoring/prometheus.yml`, the one definition of the
API's scrape job: target `host.docker.internal:3001` (or the `PORT` the API
listens on), the token handed in as a compose secret. The scripts read
`.env` and `.env.local` the way the API does. With `METRICS_TOKEN` empty the
container refuses to start and says why. Grafana's provisioning is
`docker/monitoring/grafana/`: the Prometheus data source as the default (the
dashboard's `DS_PROMETHEUS` resolves to it) and a file provider over
`grafana/` here.

## Scraping the dev server

No container publishes a port, so the scraper joins the compose `edge`
network (or the tailnet) and reaches the API at `api:3001`, not through the
public origin. The scrape job is the `oppenheimer-api` job in
`docker/monitoring/prometheus.yml` with two changes: the target is
`api:3001`, and `password_file` is wherever that Prometheus keeps the token
(say `/etc/prometheus/oppenheimer-metrics-token`). `rule_files` points at
this directory's `prometheus/*.rules.yaml`, and `config/api.env` on the server sets `METRICS_TOKEN` (`openssl rand -hex 32`).

## Keeping them honest

`apps/api/src/__tests__/monitoring-config.spec.ts` parses both files and fails
when a rule or a panel names a metric the API does not export, or a rule lacks
a severity or a summary. CI has no `promtool`, so the PromQL itself is not
type-checked there; the local Prometheus image carries one:

```bash
docker run --rm -v "$PWD/deploy/dev/monitoring/prometheus:/rules:ro" \
  --entrypoint promtool quay.io/prometheus/prometheus:v3.5.0 \
  check rules /rules/api.rules.yaml
```

`promtool test rules` (unit tests for the alerts) is the next step.
