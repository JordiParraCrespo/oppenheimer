---
"@oppenheimer/api": patch
"@oppenheimer/backend-queue": minor
"@oppenheimer/shared": minor
---

BullMQ jobs no longer stay in Redis for ever: every queue removes completed jobs after an hour (at most 1,000) and failed ones after a week, and the durable queues keep their 24-hour window. Emails are retried five times with exponential backoff instead of failing on the first provider error. Each queue is registered once, in the API's `QueueModule`, so every producer gets the same options. The unused `file-processing` queue (`QUEUE_NAMES.FILE_PROCESSING`) and the unused `QueueModule` export of `@oppenheimer/backend-queue` are removed; the package now exports `setupBullBoard` only.
