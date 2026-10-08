# Monitoring

The API's Prometheus alert rules and Grafana dashboard, kept here as the
source of truth. Nothing on the dev server runs Prometheus yet: whoever runs
the monitoring stack loads these files.

| File | What it is |
|---|---|
| `prometheus/api.rules.yaml` | Alerts: availability, 5xx and latency by route, event-loop lag and heap, outbox and queue backlog, and the backlog sampler's own health |
| `grafana/api.json` | The dashboard: traffic, latency, backlog, process. Import it and pick the Prometheus data source |

What each metric means, and how the API exports it (`METRICS_TOKEN`, HTTP
Basic auth on `GET /api/v1/metrics`), is
[`apps/docs/docs/deployment/monitoring.md`](../../../apps/docs/docs/deployment/monitoring.md).

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
a severity or a summary. There is no `promtool` in the toolchain, so the
PromQL itself is not type-checked: `promtool check rules` and
`promtool test rules` are the next step once a Prometheus runs.
