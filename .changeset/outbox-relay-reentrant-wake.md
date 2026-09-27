---
"@oppenheimer/backend-ddd": patch
---

The outbox relay no longer deadlocks when a delivery wakes it. An event handler
that dispatches a command whose repository stages a row and calls `wake()` ran
inside the drain it then waited on; every later wake queued behind the pair.
A wake from inside a delivery now queues its pass and returns at once.
