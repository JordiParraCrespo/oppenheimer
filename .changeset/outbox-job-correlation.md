---
"@oppenheimer/api": patch
---

Every job staged on the outbox carries the correlation id of what owed it,
passed explicitly: an inbound delivery's processing job takes the receiving
command's, an automation run's dispatch the firing command's (an event-fired
run inherits the webhook's id through the event's metadata), and the sweeps
that re-stage lost jobs record none.
