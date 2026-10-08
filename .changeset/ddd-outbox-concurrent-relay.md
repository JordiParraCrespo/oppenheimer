---
"@oppenheimer/backend-ddd": minor
---

The outbox relay publishes a claimed batch concurrently and marks it once every row settles; `stageJob` records the request context's correlation id by default; `OutboxService.countFailed()` counts the rows parked as `failed`.
