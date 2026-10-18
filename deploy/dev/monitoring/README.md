# Monitoring

The API's Prometheus alert rules and Grafana dashboard, kept here as the
source of truth. Nothing on the dev server runs Prometheus yet; on a
development machine, `pnpm monitoring:up` runs one with these rules (below).

| File | What it is |
|---|---|
| `prometheus/api.rules.yaml` | Alerts: availability, 5xx and latency by route, event-loop lag and heap, outbox and queue backlog, and the backlog sampler's own health |
| `grafana/api.json` | The dashboard: traffic, latency, backlog, process. Import it and pick the Prometheus data source |

What each metric means, and how the API exports it (`METRICS_TOKEN`, HTTP
Basic auth on `GET /api/v1/metrics`), is
[`apps/docs/docs/deployment/monitoring.md`](../../../apps/docs/docs/deployment/monitoring.md).

## Running it locally

`docker/docker-compose.monitoring.yml` is a Prometheus that scrapes the API
`pnpm dev` runs on the host and loads every `*.rules.yaml` in `prometheus/`
here, so the rules are evaluated against real series before they reach a
server:

1. Set `METRICS_TOKEN` in the root `.env` (`openssl rand -hex 32`) and
   restart the API; without it `/api/v1/metrics` is a 404.
2. `pnpm monitoring:up`, then `http://localhost:9090`: Status → Targets shows
   `oppenheimer-api` up, Alerts shows the rules.
3. After editing a rule, `curl -X POST localhost:9090/-/reload` re-reads it.
   `pnpm monitoring:down` stops it; `docker compose -f
   docker/docker-compose.monitoring.yml down -v` also drops the 7 days of
   data it keeps.

Its config is `docker/monitoring/prometheus.yml`: the same scrape as below,
with the target `host.docker.internal:3001` and the token handed in as a
compose secret.

## Scraping the dev server

No container publishes a port, so the scraper joins the compose `edge`
network (or the tailnet) and reaches the API at `api:3001`, not through the
public origin:

```yaml
scrape_configs:
  - job_name: oppenheimer-api
    metrics_path: /api/v1/metrics
    basic_auth:
      username: prometheus
      password_file: /etc/prometheus/oppenheimer-metrics-token
    static_configs:
      - targets: ["api:3001"]
rule_files:
  - /etc/prometheus/rules/api.rules.yaml
```

and `config/api.env` on the server sets `METRICS_TOKEN` (`openssl rand -hex 32`).

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
