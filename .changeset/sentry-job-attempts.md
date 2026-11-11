---
"@oppenheimer/backend-error-reporting": patch
"@oppenheimer/api": patch
---

Sentry no longer reports each attempt of a queued job as its own unhandled
issue. Sentry's NestJS SDK wraps every BullMQ `@Processor` and captured every
throw from it: each attempt BullMQ retries, and each `DelayedError` or
`RateLimitError` a worker throws to wait (OPPENHEIMER-API-5: four events from
one bot summary job retrying through a provider overload). Those captures are
dropped in `beforeSend`.

A job that fails for good is still reported once, grouped by queue and job.
That report is now made with a fresh error carrying the job error's name,
message, stack and cause. Before, the SDK had already captured the worker's
own error and skipped the report.
