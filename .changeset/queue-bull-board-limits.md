---
"@oppenheimer/backend-queue": minor
---

Bull Board sign-in is limited and refuses weak passwords.

- After `maxFailures` (default 10) failed Basic sign-ins from one client
  address within `failureWindowMs` (default 15 minutes), the dashboard answers
  `429` with `Retry-After` and does not check the credentials. The limiter is
  in memory, per process, and bounded (`maxTrackedClients`, default 10 000).
- `setupBullBoard` returns `false` and mounts nothing when the password is
  shorter than `BULL_BOARD_MIN_PASSWORD_LENGTH` (16), which is now exported.
