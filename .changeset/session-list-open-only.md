---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": patch
---

The console's session list reads only the sessions that are not resolved,
so one read is one request however many sessions have been closed.

- `@oppenheimer/api`, `@oppenheimer/shared`, `@oppenheimer/api-client`:
  `GET /v1/sessions` takes `resolved` (`true` or `false`, read as the
  literal): `false` leaves resolved sessions out, `true` keeps only them;
  absent, both, as before.
- `@oppenheimer/frontend-consumer`: `SessionsRepository.findAll` asks for
  `resolved=false`. It walked every resolved tombstone and dropped them in the
  browser, which at 499 sessions with 20 open made each list read five
  requests; with the workspace stream refetching the list on every session
  change, that tripped the API's rate limit (`RATE_001`). A close the console
  watched that ends with its row gone re-reads that session's detail, since no
  list row writes it any more.
