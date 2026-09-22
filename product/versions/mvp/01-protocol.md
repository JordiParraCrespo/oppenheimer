# 01 — Protocol

This note owns the wire. Anything about frames, messages, hints or which
call rides which socket is decided here; 02 and 09 describe what the
runner does with it and point back.

## Decided

### Parties and sockets

- Three parties: browser, control plane, runner. The runner dials out;
  the browser never reaches the runner directly in the MVP (the direct
  tailnet path is later).
- **Two sockets, two shapes**, and that is deliberate rather than a
  temporary inconsistency:
  - **the runner link**, one per host, multiplexed, because a host with
    twelve sessions should not hold twelve sockets through the relay;
  - **the browser attach socket**, one per attachment, unmultiplexed,
    because the browser already has one socket per pane and a header on
    every PTY read would buy nothing.
- **The link is not the only outbound connection.** Registration and
  release manifests are ordinary HTTPS (below). "No inbound ports" is
  the property that matters; "one socket" was a slogan.

### Framing

- PTY bytes travel as binary WebSocket frames, one frame per PTY read,
  no JSON wrapping and no base64. Control messages are JSON text frames
  on the same socket.
- On the runner link a binary frame is a **4-byte big-endian attachment
  id** followed by the bytes.
- An **attachment** is one PTY on one window for one browser
  connection. It is the unit of streaming, of flow control and of
  resize, and it is what the id names. A session has windows; a window
  may have several attachments at once (a laptop and a phone watching
  the same pane), and each gets its own id. Session ids and window
  indices never appear in a binary frame.
- The control plane allocates attachment ids per link and frees them on
  detach.

### Authentication

- The runner authenticates once with a registration token, then signs a
  short-lived JWT **per dial** — not per boot; a reconnect after a
  dropped link mints a new one. EdDSA over the host's Ed25519 key,
  five-minute expiry, `aud` the control plane's URL, and a `jti` the
  control plane may replay-check.
- The runner pins the control plane's key fingerprint, received at
  registration, and refuses any other (F6).
- EdDSA is a **new verifier on the control plane**: `packages/go/auth`
  ships HS256 service tokens today and the API verifies its own
  sessions. Where that verifier lives and what it checks is 03.
- Job payloads carrying secrets are encrypted to the runner's public
  key (F7). Attach tickets are single-use and seconds-lived (F1).

### What rides the link

- `session.create | attach | input | resize | detach | window.open |
  window.close | stop | close | restart`. `stop` ends the agent and the
  tmux session and keeps every checkout (02 §5, "Stop is not close");
  `detach` frees an attachment the browser let go of. `input` is the
  control plane's own path for a window nobody is watching (the
  composer's line on a session with no pane open); an attached browser's
  keystrokes are **not** it — they are binary frames on the attach socket,
  copied onto the link as binary frames under the attachment id, the
  same layout as the PTY output the other way.
- **`welcome`** is the control plane's answer to `hello`: the protocol
  version the two will speak and the fingerprint of the control plane's
  signing key, which the runner compares against the one it pinned at
  registration and refuses on mismatch (F6). A runner below
  `min_supported` never sees one — it gets the `update_required` hint.
- **`command.failed`** is the runner's only reply to a command, and only
  for a failure to carry it out (`commandId`, a catalog code, a detail).
  Success is never reported this way: a created session says so with
  `session.started` in its log, an attachment says so with its first
  frame. **`attachment.closed`** is the runner freeing an id whose PTY
  ended on its own.
- **`session.create` carries the launch**, because how a session is
  started is part of what the runner is being asked to start. Three
  fields beyond the checkouts: `launch` (`{ model?, permission, effort? }`),
  `prompt` (the person's first task, optional), and the slugs and
  checkouts the directory layout needs.

  `launch` is **structured, not argv**. The control plane sends what the
  person chose in the composer's foot row and the host maps it to its own
  flags, reading the same catalog entry it already reads for `command`
  (`packages/shared/src/agents/catalog.ts`; what the runner does with it
  is 02 §5). Argv on the wire would put one CLI's spelling in a message
  every agent shares, and would make a flag change a protocol change.

  It **replaces** the bare `model` this message carried while a model was
  the only launch option there was. One shape, not both: the three travel
  together, and the fold keeps them on the session so a restart
  reproduces the launch (03).

  `prompt` rides the create rather than arriving as a `session.input`
  after `session.started`, and that is the whole reason it is a launch
  field: input needs the agent up, and "the agent is up" is a moment only
  the host can name. Appended to the launch argv, the task is there before
  the process starts and there is nothing to synchronise. A session
  created while its host is offline therefore keeps its task in the log
  and delivers it when the launch is finally dispatched.
- **`session.create` carries `runtime`** (v0.2): `host` (a tmux session
  on the machine, the MVP) or `microvm` (a Firecracker VM on that host,
  02 §14). The host refuses `microvm` with `command.failed` when its
  capabilities do not include `vm`. Inside a microVM the guest speaks
  this same vocabulary to the runner over vsock; the link never sees
  the guest.
- **`stop` may carry `push: true`** (v0.2): the runner pushes every
  checkout's working branch before ending the agent, the push `close`
  performs without the removal, so a host the control plane is about to
  put to sleep loses nothing committed (02 §5). Nothing else changes on
  the wire for cloud machines: `machine.*` events are the control
  plane's own writes to the log, and a cloud host registers, dials and
  is driven exactly as any other (03 §Cloud hosts).
- `host.preflight`, `host.update`
- `credentials.token` — the runner asks for the installation token for
  one session's repository; the control plane answers with
  `credentials.grant`, carrying the token sealed to the host's key and
  its expiry, and may push `credentials.revoke` to drop it early. It is
  on the link because the token is per session and the link is the only
  channel already authenticated per host; a second HTTPS path would need
  a second auth story for nothing. The grant is its own message rather
  than an optional field on the ask, so neither peer infers a direction
  from which fields happen to be present.
- `events.append` and `events.ack` — the runner sends a batch of one
  session's events, each with its own `<runId>:<n>` idempotency key, and
  the control plane acknowledges **by key**. A WebSocket cannot tell
  "persisted before the disconnect" from "never arrived", so the runner
  keeps a batch until an ack accounts for every key in it and resends
  otherwise; the append is `ON CONFLICT DO NOTHING` per row, which is
  what makes the resend free. The log the batch lands in is 03's; the
  wire that carries it is this note's.
- `attachment.credit` — the browser's consumed-byte credit, relayed to
  the runner so it resumes that attachment's PTY reads. Without it the
  window below is a one-way valve: a noisy pane stalls for good rather
  than briefly.
- Every command is idempotent by session id and command id, because a
  reconnect may redeliver.

### What does not ride the link

Three calls are ordinary outbound HTTPS, and each has a reason:

| Call | Why not the link |
|---|---|
| `POST /api/v1/hosts/register` | There is no link yet; this is what creates the identity that authenticates one |
| `DELETE /api/v1/hosts/self` | Uninstall runs with the daemon stopped; authenticated by the host's boot JWT as a bearer, and the host names itself by the token's subject |
| `GET <release base>/<channel>.json` and `.sig` | It must work when the link will not come up |

That last one is the escape hatch, and it is the reason the release
manifest is signed by an offline key rather than trusted because the
control plane said so: a runner the control plane refuses on protocol
grounds can still fetch, verify and install the version that fixes it
(09 §5).

### Hello, heartbeat and hints

- **Hello**, the first message after the upgrade: runner version, the
  protocol range it speaks, host facts, and a snapshot of every session
  it holds. The control plane reconciles against its own state rather
  than replaying a queue.
- **Heartbeat**, every 15 s: per-session state, host load, free disk on
  the workspaces filesystem, the versions of `git`, `tmux` and the
  agent, and the update channel.
- **Hints** may ride a heartbeat reply or the attach socket, and the
  vocabulary is closed: `update_available`, `update_required`,
  `blocked` with a retry-after (`../../12-lessons-from-grok-bot.md`). The
  attach socket may additionally say `host_offline`, for a session whose
  host has no link right now — said **on the socket**, after the ticket
  is redeemed, and never on the ticket itself: the issuer does not ask a
  dispatcher, so any hint it put on a ticket would be a guess about a
  link it cannot see, and whether the host is reachable is the relay's
  answer on the socket that tries. That kind is the attach socket's alone
  and is **not** a link hint: a runner connected enough to send a frame
  cannot coherently report itself offline. So the two sockets share three
  kinds and the attach socket has a fourth.
- A runner below the control plane's `min_supported` is refused at
  hello **with** `update_required` rather than dropped, and the
  supported window is N-2 minor versions (03).

### Flow control and reconnect

- The browser acks consumed bytes, the control plane relays the credit,
  and the runner pauses that attachment's PTY reads when its window
  (256 KB) is exhausted. A runaway build stalls its own pane, never the
  link.
- Reconnect ladder 0.5 s, 1, 2, 5, 10, 30 with jitter, and an epoch
  counter bumped on every successful connect; frames and callbacks from
  an older epoch are dropped (`../../12-lessons-from-grok-bot.md`).

## Open questions

1. ~~Schema language for the shared package: JSON Schema with generated
   TypeScript and Go, or protobuf.~~ **Decided: Zod is the source.** The
   messages above live as Zod schemas in `packages/shared/src/protocol/`,
   which is what this repo already uses for DTOs, so the wire is not a
   second schema language to learn. JSON Schema is emitted from that
   union at build into
   `packages/shared/protocol-schema/protocol.schema.json` and committed,
   and the Go structs are generated from the artifact — one source, two
   languages, no hand-written twin. Protobuf was the alternative and buys
   little here: the control frames are small and infrequent, the bytes
   that matter are already raw binary frames, and a second toolchain is a
   cost on every contributor.
2. ~~One socket per session from the browser, or multiplexing?~~
   Decided above: one per attachment, unmultiplexed.
3. ~~Runner to control plane: one socket or one per session?~~ Decided
   above: one multiplexed link per host.
4. ~~Heartbeat interval and contents~~: decided above.
5. ~~Token rotation, pushed or pulled~~: decided above — pulled, on the
   link.
6. ~~Do the two sockets share one schema?~~ Decided above: they do not,
   and the hint vocabulary is the only thing they share.
7. ~~Whether the attach ticket carries the attachment id or the control
   plane assigns it on the upgrade.~~ **Decided: assigned on the upgrade**,
   by the relay, per link, once the ticket is redeemed and the session's
   host has a link — so a ticket that is never redeemed costs nothing, and
   the ticket carries no id, no hint and nothing the relay decides later
   (03, "The relay, as built").
