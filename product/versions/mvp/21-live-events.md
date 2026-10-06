# 21 — Live events: the console hears what changed

The console learned about every change it did not make itself by polling:
one `pollWhile(kind, …)` per fact, catalogued in `LIVE_POLL`
(`packages/frontend/consumer/src/react/live-poll.ts`, decided in 05 and the
2026-10-01 entry). This note replaces those polls with one stream the API
pushes to, a slice at a time, behind the `live_events` flag. The issue is
JordiParraCrespo/oppenheimer#239.

## Why

| Poll | What it watches | Interval |
| --- | --- | --- |
| `sessionStarting` | the session list while a row starts, or a close waits on its host (≤ 60 s) | 2 s, hidden tab too |
| `sessionOpening` | one session's row while it starts, or a restart waits (≤ 60 s) | 300 ms for 3 s, then 2 s |
| `pairing` | a pairing token spent, its machine online | 3 s |
| `liveRun` | an automation run, queued then running | 5 s |
| `hostPresence` | a host going on or offline | 15 s, paused when hidden |

- **Latency.** A change shows between 0 and one interval after it happens. A
  session start pays this on the stretch the reader is watching; the 300 ms
  opening phase exists to hide it.
- **Requests.** Each poll reads a whole list to learn about one row. Note 14
  measured what that costs at a faster pace: the list, detail and events
  polls together hit the default rate limit (HTTP 429, 100 per 60 s), and
  the console read `starting` for 21 s after `session.started`.
- **Code.** The close and restart watches, the per-query opening clock and the
  poll catalog exist only to decide when to ask again.
- **What no poll covers.** A session's turn (working, waiting on the person)
  was never polled at all: the list showed it as of its last read.

## Decided (slice 1: sessions)

- **The wire is server-sent events**, `GET /api/v1/live`, one stream per
  console tab, scoped to the caller's active workspace. The stream only flows
  from the server, so SSE is enough: it goes through the console's nginx
  `location /api` as it is (buffering off, 1 h read timeout, already there for
  the attach socket), and the browser's `EventSource` dials again by itself.
  The terminal's WebSocket stays what it is.
- **It carries ids, never rows.** An event is `{ "type": "session.changed",
  "sessionId": … }` (`@oppenheimer/shared/live`). A console that hears one reads
  the row again through the endpoint it already uses, under its own
  authorization, so the stream is no second way to see data and cannot
  disagree with the read model.
- **The facts come from domain events that already existed.** The `live`
  module listens to `SessionCreatedDomainEvent`,
  `SessionStateChangedDomainEvent` and `SessionTurnChangedDomainEvent`, each
  of which carries its `organizationId`. The outbox delivers one to one
  replica; the console's stream lives on whichever replica it dialled.
- **Replicas meet in Redis pub/sub**, one channel per workspace
  (`live:org:<organizationId>`). Publishing uses the API's shared command
  client; hearing takes one subscriber connection per process, subscribed to
  a workspace's channel only while a console of it is open on that replica.
  This is the first pub/sub in the API: the attach socket chose a timer over
  pub/sub for revocation (`REAUTHORIZE_INTERVAL_MS`), which still stands.
- **A publish is best effort.** A failed publish is logged and dropped, not
  retried: retrying would mean failing the outbox delivery, which redelivers
  the event to every other listener too, to save a read the console makes
  anyway on its next dial.
- **A stream lives five minutes** (`LIVE_STREAM_MAX_AGE_MS`), then the API
  ends it and the browser dials again. A dial is where the guards run: the
  caller's session, workspace, `read Session`, `sessions:read` and the flag.
  So a revoked caller hears ids for at most five minutes — ids, not data, and
  every read behind them is authorized on its own. A `ping` every 25 s keeps
  proxies from idling it out.
- **A refusal means poll.** 401, `FLAG_003` (the flag is off for the caller),
  `LIVE_002` (no active workspace) and `LIVE_001` (the API cannot reach Redis,
  answered before the stream opens rather than opening one that never speaks)
  all leave the console polling, and it dials again after 60 s
  (`CONSUMER_CONFIG.live.redialAfterRefusalMs`).
- **Polls stop only while the stream is up.** `pollWhile` takes `streamed`;
  `useSessions` and `useSession` pass whether the stream is `live` right now,
  so a drop gives the polls back on the next render. The start log
  (`useSessionStartProgress`) still polls: its steps are log entries, not
  domain events.
- **Coming up reads everything again.** Each time the stream comes up, the
  first dial or any dial after a drop, every read it covers (`sessions/*`) is
  read again, because nothing says what changed while it was down. That is
  the cost of a dial: one read per open session screen, about every five
  minutes.
- **`live_events` is a release flag**, default off, expiring 2026-12-31. It
  gates the route on the server (`@RequireFlag`) and the dial on the client
  (`useFeatureFlag`), so turning it off is always safe: the console polls as
  it did.

## Not yet carried

| Fact | What would raise it | Slice |
| --- | --- | --- |
| A session renamed or moved from another tab | no domain event today; this tab's own writes already update its cache | with the event |
| A host going on or offline | `HostPresencePort.observe` and the link's close; no domain event today | 2 |
| An automation run queued, running, ended | the automation run's own transitions | 3 |
| A pairing token spent | `HostRegisteredDomainEvent` (exists) | 4 |
| A session's start steps | the session event log the runner appends | with the start pane |

Done is when every row of the first table is driven by the stream,
`LIVE_POLL` is only the fallback, and the close and restart watches are gone.

## Open questions

- Is five minutes the right revocation bound, or should a stream be judged
  again on the attach socket's 60 s timer? Ids leak nothing a read would not
  refuse, which is why five was chosen.
- Does every host fact the console polls for reach the API as something a
  handler can hear? Presence is written, not raised; slice 2 has to decide
  whether presence becomes a domain event or the relay publishes directly.
- Should an event ever carry the row, to save the read? Not while reads are
  cheap and authorization lives in them.
