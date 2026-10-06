# 21 — Workspace events: one stream instead of the polls

The console learned about everything that changes on its own by polling,
one entry per fact in `LIVE_POLL`
(`packages/frontend/consumer/src/react/live-poll.ts`). This note replaces
those polls with one server-pushed stream per console tab, behind the
`workspace_event_stream` release flag, with polling kept as the fallback
until the stream has proven itself. Issue: JordiParraCrespo/oppenheimer#239.

## What was polled, and what replaces it

| Poll | What it watched | Event that now drives it | Published by |
| --- | --- | --- | --- |
| `sessionStarting` | the session list while a row starts or a close waits on its host | `session.changed` | `WorkSessionRepository`, after every committed append (create, each start step, open, fail, stop, restart, close, rename, move, checkout) |
| `sessionOpening` | one session's row and its start log | `session.changed` (the detail's key prefix holds the start log) | same |
| `pairing` | a pairing token being spent and its machine coming online | `pairing.spent`, then `host.changed` | `HostPairedOrUnpairedDomainEventHandler` on `HostRegistered`; presence below |
| `liveRun` | an automation run, queued then running | `automationRun.changed` | the run repositories after a run is queued, skipped, dispatched or deferred; `RunSessionChangedDomainEventHandler` when its session's automation turn or lifecycle moves |
| `hostPresence` | a host going online or offline | `host.changed` | `HostPresenceResolver`: on a hello, and once the online window has passed after a link closed; on unpair |

## Decided

- **Events are invalidations, never data.** An event is
  `{ type, id, … }` (`@oppenheimer/shared/workspace-events`). The console
  answers it with `invalidateQueries` on the keys that already exist, so
  every read keeps its endpoint, its authorization, its cache key and its
  `shareEntities` sharing. A lost event costs a screen the time until its
  next refetch, never a wrong answer.
- **Transport: Server-Sent Events**, `GET /api/v1/events`. The stream only
  flows server → browser, `EventSource` sends the session cookie and
  reconnects on its own, and nginx's `/api` block already has buffering off
  and an hour's read timeout. The terminal's WebSocket stays separate.
- **Fan-out: Redis pub/sub.** A domain event is handled on one replica
  (the outbox), and the stream may be held by another; every publish goes
  to a Redis channel and each replica holds one subscriber connection,
  shared by all its streams, a channel subscribed while any stream wants it.
  The subscriber does not use the command client's fail-fast options: it
  waits for Redis, and the stream says `ready` only once subscribed.
- **Audience: the workspace and the person.** Sessions and runs belong to a
  workspace (`workspace-events:org:<id>`). Hosts and pairing tokens belong
  to the person who paired them (`hosts.resource.ts`), so their events go to
  `workspace-events:user:<id>`. A stream subscribes to both for its caller.
- **`ready` is what makes the stream count.** The console stands its polls
  down only from the stream's `ready` frame, sent once the subscription is
  in place, so an event published between the request and the subscription
  is never assumed seen.
- **Missed events: refetch what the stream covers.** Whenever the stream
  goes live or drops, the console invalidates every key it covers: on the
  way up it catches what happened before the subscription, on the way down
  it is the read that brings each poll back. One refetch per open screen,
  the same as a focus refetch.
- **Publish after commit.** A repository publishes once its transaction has
  returned; an outbox event handler runs after commit by construction. A
  console refetch can therefore never read the row before the change.
- **Rollout.** `workspace_event_stream` (release, default off, bucketed by
  workspace) gates the endpoint with `@RequireFlag` and the console with
  `useFeatureFlag`. Off, nothing changes. On, `pollWhile` returns `false`
  for every kind while the stream is live and resumes when it drops, so
  `LIVE_POLL` is the fallback.

## The issue's open questions, answered

1. **Which version?** The MVP. The polls it replaces are the MVP's own
   (05, the 2026-10-01 opening poll), and nothing in 0.7's terminal and chat
   display depends on it. Recorded in `../../README.md`.
2. **A session that expires mid-stream.** The API ends every stream after
   15 minutes (`STREAM_MAX_LIFETIME_MS`); `EventSource` redials at once and
   the redial is authenticated like any request. A revoked or expired
   session therefore stops receiving within 15 minutes, a 401 closes the
   stream for good, the console's polls come back, and their own 401 signs
   the reader out as before. A keepalive every 25 s keeps idle streams
   under proxy timeouts.
3. **Does the runner link carry every fact?** Start steps, close and
   restart acknowledgements are all session log entries the runner appends
   over the link, and every committed append announces the session, so yes.
   Presence is the exception: it is derived from `lastSeenAt` and never
   stored, so the resolver announces the two moments it changes — a hello,
   and the online window running out after the link closed.

## Known gaps

- If the replica holding a link dies together with the runner, no replica
  sees the close and nothing announces the host going offline; the console
  learns at its next refetch of the list (a focus, a navigation).
- A host borrowed through a grant is announced only to its owner.
  Workspaces are personal (08), so there is no one else yet.
- A host rename announces nothing; the tab that renamed refetches, another
  tab learns at its next refetch.

## Done when

Every row of the table is driven by the stream with the flag on for every
workspace. Then the close and restart watches in `sessions.queries.ts` and
the opening phase of `sessionOpening` are deleted, `LIVE_POLL` shrinks to the
fallback it is, and the flag (due 2027-01-31) goes.
