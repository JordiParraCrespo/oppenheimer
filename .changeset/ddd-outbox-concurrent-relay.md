---
"@oppenheimer/backend-ddd": minor
---

The outbox relay publishes a claimed batch concurrently and marks it once every row settles, reading what went out from the settled results. `markProcessed` returns the ids it marked (the same shape as `extendLease`), and the relay counts only those, so a row whose lease was lost mid-delivery is not counted as delivered. `stageJob` takes `correlationId: string | null` from its caller (a command's or an event's `metadata.correlationId`, `null` for a sweep) and no longer reads the request context. `OutboxService.backlog()` reads the pending count, the failed count and the oldest pending `createdAt` in one statement, and `OutboxMessageSchema` declares the partial index `IDX_outbox_message_failed` that serves its failed count. A command's `metadata` may be passed in part (`{ correlationId }`), as a domain event's already could.
