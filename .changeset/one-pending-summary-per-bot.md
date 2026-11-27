---
"@oppenheimer/api": patch
---

A bot keeps one pending conversation-summary job. Every turn that ended past
the summary threshold used to add its own job, so a bot whose provider was
rate-limiting held a pile of delayed folds that all woke at the reset and were
refused again. The relay now adds `bot-summaries` jobs under BullMQ
deduplication keyed by the bot (`onePendingPerAggregate` in `QueueModule`):
one staged while a job waits or is delayed folds into it, and one staged while
a job runs is kept and runs once after it.
