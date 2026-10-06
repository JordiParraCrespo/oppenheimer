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

## Slices

The rules of the stream are 03 ("The live stream, as built"); the poll
fallback is 05 ("How the console learns what changed"). Their values live in
`@oppenheimer/shared/live` and `CONSUMER_CONFIG.live`. This note is the order
the polls move in.

| Slice | Facts | Raised by | Replaces |
| --- | --- | --- | --- |
| 1 (done) | A session created, its lifecycle, its turn | `SessionCreated`, `SessionStateChanged`, `SessionTurnChanged` domain events | `sessionStarting`, and `sessionOpening` for a session's row; a session's turn was never polled |

The start log (`useSessionStartProgress`) still polls in slice 1: its steps
are log entries, not domain events.

## Next slices

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
