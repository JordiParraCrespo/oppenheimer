---
"@oppenheimer/api": minor
---

Backlog gauges: `queue_jobs{queue,state}` for every BullMQ queue,
`outbox_messages{status}` (pending, failed) and
`outbox_oldest_pending_age_seconds`, sampled every `METRICS_SAMPLE_INTERVAL_MS`
(15 s) while `METRICS_TOKEN` is set, with `backlog_sample_success` and
`backlog_sample_timestamp_seconds` per source so a failed or stale sample shows.
