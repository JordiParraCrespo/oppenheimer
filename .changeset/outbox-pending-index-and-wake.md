---
"@oppenheimer/backend-ddd": minor
"@oppenheimer/shared": patch
"@oppenheimer/api": patch
---

The outbox no longer puts delivery on the request path, and no longer grows
for ever.

- `OutboxService.wake()` returns `void` and does not wait for the drain it
  asks for. Before, `await wake()` resolved only after every drain queued
  ahead of it and a drain of every due row, listeners included, had finished,
  so a webhook accept or a runner `events.append` waited on the global
  backlog. Call it without `await`; an `await` on it still compiles and does
  nothing. Nothing tells a caller when its listeners have run.
- `OutboxRelay.requestDrain()` runs at most one drain at a time; requests
  that land during it collapse into one more pass, instead of an unbounded
  chain of passes. `drainOnce()` still waits for the drain.
- The relay marks a batch processed in one statement. A process that dies
  between publishing and that statement redelivers up to `batchSize` rows,
  which at-least-once delivery already allowed.
- New `OutboxService.deleteProcessedBefore(cutoff, batch)`: the batched
  retention delete of `processed` rows. The API runs it daily
  (`QUEUE_NAMES.OUTBOX_RETENTION`, 7 days); `pending` and `failed` rows are
  kept.
- `OutboxMessageSchema` declares `IDX_outbox_message_pending` (partial,
  `("createdAt") WHERE status = 'pending'`) and `IDX_outbox_message_created_brin`
  in place of `IDX_outbox_message_status_available`, mirroring the API's
  migration `1790800000000-OutboxPendingIndexAndRetention`. On a large
  `outbox_message` table, run
  `apps/api/db/ops/1790800000000-outbox-pending-index.sql` before deploying.
