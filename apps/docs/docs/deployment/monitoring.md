---
sidebar_position: 2
---

# Monitoring

What the API tells an operator about itself, and how to read it.

## Probes

| Probe             | Checks                                   | Answers                          |
| ----------------- | ---------------------------------------- | -------------------------------- |
| `GET /api/v1/health` | nothing: the process answered HTTP    | always `200 {"status":"ok"}`     |
| `GET /api/v1/ready`  | PostgreSQL and Redis, side by side    | `200` when both are `ok`, else `503` |

- **Liveness checks no dependency.** It is what a container restart acts on,
  and a restart fixes nothing about a database outage. It checks no heap
  threshold either: a fixed number restarts a busy process at its peak, and a
  process that really runs out of memory is ended by V8 anyway. The heap is
  a metric (`nodejs_heap_size_used_bytes`) and an alert, not a probe.
- **Readiness has a deadline per dependency** (`HEALTH_DATABASE_TIMEOUT_MS`,
  2 s, and `HEALTH_REDIS_TIMEOUT_MS`, 1 s), enforced by the probe rather than
  the driver, so its worst case is the longer of the two. Only an explicit
  answer of "up" counts as up.
- **The body is a fixed vocabulary.** Each check is `{"status":"ok"}` or
  `{"status":"error","message":"unavailable"}`; whether it timed out or what
  the driver said is in the API log (`Readiness: PostgreSQL timed out`), never
  in a public response.

## Metrics

The API exports Prometheus metrics at `GET /api/v1/metrics`. The endpoint is
an optional capability: it exists only when `METRICS_TOKEN` is set (at least 32
characters; `openssl rand -hex 32`), and Prometheus presents that token as the
password of HTTP Basic auth. Without the token, or with the wrong one, the
answer is a plain 404, the same as any path that does not exist.

```yaml
# prometheus.yml
scrape_configs:
  - job_name: oppenheimer-api
    metrics_path: /api/v1/metrics
    basic_auth:
      username: prometheus
      password_file: /etc/prometheus/oppenheimer-metrics-token
    static_configs:
      - targets: ["api:3001"]
```

Basic rather than a bearer token: every bearer the API sees is resolved as a
credential (an API token, an OAuth grant, a session) and refused when it is
none of them. Scrape the API on its private address where you can: the
console's nginx proxies all of `/api` to it, so the token is what keeps the
endpoint closed on a public origin.

| Metric                                      | Type      | Labels                  |
| ------------------------------------------- | --------- | ----------------------- |
| `http_requests_total`                       | counter   | `route`, `status_class` |
| `http_request_duration_seconds`             | histogram | `route`                 |
| `queue_jobs`                                | gauge     | `queue`, `state`        |
| `outbox_messages`                           | gauge     | `status` (`pending`, `failed`) |
| `outbox_oldest_pending_age_seconds`         | gauge     | —                       |
| `backlog_sample_success`, `backlog_sample_timestamp_seconds` | gauge | `source` (`queues`, `outbox`) |
| `process_*`, `nodejs_*`                     | various   | —                       |

Every series also carries `app="api"`.

- **`route` is a group, never a path.** The policy in
  `apps/api/src/health/infrastructure/http-metrics.config.ts` maps route
  templates to about fifteen product areas (`sessions`, `hosts`, `github`,
  `account`, …); anything it does not know, including every unknown URL, is
  `other`. `events` (the server-sent change feed, open as long as a tab is) and
  `webhooks` (GitHub's deliveries) are separate because their latency means
  something else. A new controller prefix fails the API's unit tests until it
  is given a group.
- **`status_class`** is `1xx`–`5xx`, `aborted` for a connection the client
  closed before the answer was written (counted, never timed), or `other`.
  Every group and class exists from boot at zero, so a rate over "5xx" is 0,
  not absent, before the first failure.
- **What is not counted:** the probes (`/health`, `/ready`) and the scrape
  itself; and the routes mounted before Nest's middleware, Better Auth's
  `/api/auth/*` and Bull Board's `/admin/queues`, which record as nothing
  rather than as `other`.
- **The backlog gauges are sampled**, every `METRICS_SAMPLE_INTERVAL_MS`
  (15 s) and only while `METRICS_TOKEN` is set, not at scrape time, so a slow
  database cannot stall a scrape. `queue_jobs` is every BullMQ queue in the
  states `waiting`, `active`, `delayed`, `prioritized` and `failed`;
  `outbox_messages` is what the outbox still owes. A failed sample keeps the
  last values and sets `backlog_sample_success` to 0.

## Alerts and the dashboard

`deploy/dev/monitoring/` holds the Prometheus alert rules
(`prometheus/api.rules.yaml`) and a Grafana dashboard (`grafana/api.json`),
kept in the repository as the source of truth and loaded by whoever runs the
monitoring stack; its README has the scrape config. The rules cover the API
being absent or restarting, the 5xx ratio overall and by route, p95 latency,
clients aborting, event-loop lag and heap, an outbox row left undelivered for
five minutes, failed outbox rows and queue jobs, and the backlog sampler
itself failing or going stale. A spec in the API fails when a rule or a panel
names a metric the API does not export.

