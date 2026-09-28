---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": patch
---

Cheaper runner-link traffic and a keyset session list.

- `@oppenheimer/api`: a batch of session events lands in one `INSERT` (the
  `MAX(seq)` read still runs after the row lock, in its own statement), and the
  runner's append no longer reads the session before its transaction
  (`appendEventsForHost`). A link's queued `events.append` batches for one
  session are coalesced into one append and acknowledged per `batchId`. The
  queue is bounded: the socket is paused at 64 waiting batches, resumed at 16,
  and closed with 1013 at 256 or after a 10 s pause; the keepalive does not
  terminate a link it paused. Runner frames are capped at 512 KiB by `ws`
  itself (1009). A heartbeat is one statement when the inventory is unchanged:
  `recordVitalsIfPaired` replaces `recordVitals` and the host-row read.
  `GET /v1/sessions` takes an opaque `cursor` and answers `meta.nextCursor`;
  page mode is unchanged apart from `recent`'s id tie-break now running
  descending.
- `@oppenheimer/shared`: `listSessionsQuerySchema` takes an optional `cursor`.
- `@oppenheimer/api-client`: regenerated — `cursor` on `listSessions`,
  `nextCursor` on `SessionPageMetaDto`, whose counts are now optional.
- `@oppenheimer/frontend-consumer`: `SessionsRepository.findAll` walks the list
  by cursor instead of by page and count.
