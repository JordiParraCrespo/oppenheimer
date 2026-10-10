---
"@oppenheimer/backend-core": minor
"@oppenheimer/api": minor
---

Prometheus metrics.

- `@oppenheimer/backend-core` gains `MetricsModule.forRoot` (the application's
  own registry, with process metrics), `createMetricsProvider` /
  `InjectMetric` for a module's own counters, gauges and histograms, and
  `HttpMetricsModule.register`: `http_requests_total{route,status_class}` and
  `http_request_duration_seconds{route}`, labelled by route group through a
  policy the application owns (at most 100 rules and 20 groups), every series
  created at zero, aborted connections counted apart and never timed. Built on
  `@prometheus-io/client`, the maintained successor of `prom-client`.
- The API serves the registry at `GET /api/v1/metrics` when `METRICS_TOKEN` is
  set, to HTTP Basic auth with the token as password, and answers 404
  otherwise. The endpoint is not in the OpenAPI document.
