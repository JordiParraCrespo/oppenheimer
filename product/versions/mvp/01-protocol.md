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

- `session.create | attach | input | resize | window.open |
  window.close | close | restart`
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
- **Hints** may ride a heartbeat reply or an attach ticket, and the
  vocabulary is closed: `update_available`, `update_required`,
  `blocked` with a retry-after (note 12). An attach ticket may
  additionally carry `host_offline`, for a session whose host has no link
  right now. That kind is the ticket's alone and is **not** a link hint:
  a runner connected enough to send a frame cannot coherently report
  itself offline. So the two sockets share three kinds and the ticket has
  a fourth.
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
  an older epoch are dropped (note 12).

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
7. Whether the attach ticket carries the attachment id or the control
   plane assigns it on the upgrade. Leaning: assign on upgrade, so a
   ticket that is never redeemed costs nothing.
