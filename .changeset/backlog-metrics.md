---
"@oppenheimer/api": minor
---

Backlog gauges: `queue_jobs{queue,state}` for every BullMQ queue,
`outbox_messages{status}` (pending, failed) and
`outbox_oldest_pending_age_seconds`, sampled every `METRICS_SAMPLE_INTERVAL_MS`
(15 s) while `METRICS_TOKEN` is set, with `backlog_sample_success` and
`backlog_sample_timestamp_seconds` per source so a failed or stale sample shows.
The three outbox gauges come from one `OutboxService.backlog()` statement, so
they always describe the same moment; the new partial index
`IDX_outbox_message_failed` (migration `AddOutboxFailedIndex`) keeps its failed
count off a table scan. The next sample is scheduled only once the last one
settles, so a slow dependency spaces samples out instead of stacking them, and
every queue is resolved at boot, so a missing one fails the boot by name.
