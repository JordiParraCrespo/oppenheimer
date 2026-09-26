---
"@oppenheimer/backend-cache": patch
---

Add `setIfAbsent(key, value, ttlSeconds)` — `SET … EX … NX` in one round trip.
`get`-then-`set` is a race two callers can both win, so anything that must
happen exactly once (a replay guard, a one-shot credential) could not be built
on the previous surface.
