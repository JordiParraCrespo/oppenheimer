---
"@oppenheimer/api": minor
---

Sessions, their checkouts and the event log the row is a fold of.

`sessions/` adds `GET`/`POST /sessions`, `GET`/`PATCH`/`DELETE /sessions/{id}`,
`POST /sessions/{id}/stop`, `.../restart` and `.../attach-ticket`,
`POST`/`DELETE /sessions/{id}/checkouts` and `GET /sessions/{id}/events`, over
three tables: `work_session`, `session_checkout` — which is also where a
repository is remembered — and the append-only `work_session_event`.

The log is the truth per session and the columns are a projection of it: the
aggregate's only mutator is `recordEvent`, `seq` is assigned under a row lock so
a host cannot create gaps, and the append and the fold commit together. Nothing
is hard-deleted, so a retired session's directory name and branch are never
reissued. `POST /sessions` is idempotent by `Idempotency-Key`, and the terminal
ticket is a single-use Redis key that travels as a WebSocket subprotocol.

`DELETE /projects/{id}` archives a project and lands here too, because "is any
session still open in this project" is the one question it must ask; it asks over
the query bus and refuses when nothing answers.

Three new optional settings name the session namer: `SESSION_NAMER_PROVIDER`,
`SESSION_NAMER_MODEL` and `ANTHROPIC_API_KEY`. With none set, a session keeps the
slug it was minted with.
