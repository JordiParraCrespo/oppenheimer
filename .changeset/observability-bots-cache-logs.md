---
"@oppenheimer/api": minor
"@oppenheimer/backend-cache": minor
"@oppenheimer/backend-core": minor
---

Observability for the bots, the cache and the logs. The API exports `bot_engine_*` metrics for every bot turn and completion (runs by how they ended, failures by kind, tokens with the prompt cache's share, duration, tool calls, retries) and `cache_reads_total` for the Redis cache (hits, misses, errors by namespace), with a Grafana dashboard and alerts for both. `LOG_FILE` also writes the API's log lines as JSON to a file, which `pnpm monitoring:up` now ships to Loki through Grafana Alloy, and `pnpm logs` queries with LogQL. `@oppenheimer/backend-cache` takes an `onRead` observer; `@oppenheimer/backend-core`'s logging takes a `file`.
