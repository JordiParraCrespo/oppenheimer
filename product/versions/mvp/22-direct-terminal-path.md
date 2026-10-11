# 22 — The direct terminal path

A session's terminal reaches the browser straight from the host, over
WebRTC, with the relay as the path it starts on and falls back to. Asked
for on 2026-10-11 ("I want the sessions to be p2p … performance of the
sessions is a top priority", then "Yes I love WebRTC", and, on moving the
relay closer: "when I travel I will still have this problem"). This note
records the direction, the shape, and the order it is built in. Only
step 0 is built.

## Why

Every keystroke today crosses the relay twice before its echo is drawn
(01): browser → control plane → runner → tmux → agent, and back. The
control plane is one Hetzner box in Falkenstein (`deploy/dev/`), so a
reader in Barcelona typing into a runner in Barcelona pays two round trips
to Germany, about 80–120 ms, even when the browser and the runner are
the same machine. 06's gate (echo under 50 ms) was written for a host in
the relay's own region; a host you own is wherever you are.

Nothing on the path is slow on its own. tmux runs with `escape-time 0`,
both WebSocket ends set `TCP_NODELAY`, nothing is compressed, PTY bytes are
raw binary frames, and the runner's writer interleaves panes so a busy one
cannot hold up an echo (01, "Flow control"). The detour is the cost.

Moving the relay nearer does not answer it: the reader travels, and the
relay can be near one end only. Two things do, and they are complementary:

| Reader → host | Today (relay) | Direct | Direct + predictive echo |
|---|---|---|---|
| Same machine or same Wi-Fi | ~80–120 ms | ~1–5 ms | instant |
| Barcelona → Barcelona home | ~80–120 ms | ~10–30 ms | instant |
| New York → Barcelona home | ~200 ms | ~90–110 ms | typing instant, arrows ~100 ms |
| Tokyo → Barcelona home | ~300 ms | ~250 ms | typing instant |

The direct path removes the detour for everything (output, arrows, menus);
predictive echo hides whatever distance is left for what is typed most.

## Decided

### Step 0: measure, and predict what can be predicted (built)

- **The round trip is measured in the browser**, from a key leaving the pane
  to the next output on its stream, only when the stream was quiet before
  the key (the next chunk of a printing agent is not the echo), plus every
  prediction the host confirms (`apps/web/src/features/sessions/lib/echo-latency.ts`).
  `localStorage['oppenheimer.terminal.latency'] = '1'` draws `echo p50 / p95 ms`
  in the pane's corner. Every later step is judged by this number.
- **Predictive local echo** (`typeahead-model.ts`, `typeahead.ts`), Mosh's
  idea narrowed to the cursor's line: a character typed at the cursor,
  Backspace, Left and Right are drawn at once in an overlay over the grid,
  never written into it, and dropped the moment the host draws anything
  no guess predicted, or does not confirm one within a few round trips.
  Up, Down, Enter, Esc, Tab, chords and pastes are the program's: they go
  unpredicted and start a new epoch, and **an epoch draws nothing until the
  host confirms its first guess**, so a prompt that does not echo (a
  password) is never drawn. The cursor is the terminal's where the program
  shows it (a shell, Codex) and the one inverse cell where it is hidden
  (Claude Code, like every Ink program). It draws only above 30 ms of
  measured round trip, and the `terminal_typeahead` ops flag (on by
  default) switches it off without a deploy.

### The direct path is WebRTC, and the relay is its fallback

- **WebRTC data channels, browser to runner.** It is the only way a
  browser reaches a machine behind a home NAT without software on the
  reader's device: WebTransport needs a host with a public address and a
  certificate, and a tailnet needs a client on the reader's phone. The
  runner speaks it with pion (`github.com/pion/webrtc`), pure Go, so the
  binary stays static (`.agents/rules/go.md`).
- **One reliable, ordered data channel per attachment.** An attachment
  stays the unit of streaming, flow control and resize (01); the direct
  path is another way to carry the same attachment, not a new kind of
  connection. Binary messages are PTY bytes (the attachment is the
  channel, so no 4-byte header); text messages are the attachment's JSON
  control (credit, resize). Unordered or unreliable delivery is never
  used: a lost or reordered PTY byte cuts an escape sequence (01).
- **Every attachment opens on the relay and moves to the direct path once
  it is up.** The first frame never waits on ICE, a network that cannot
  connect directly is no slower than today, and the relay *is* the
  fallback. There is no TURN server: one on the Hetzner box would be the
  same detour as the relay, through a second service. This is how Tailscale
  moves from DERP to a direct path.
- **The control plane is the signalling channel.** The offer, the answer
  and the ICE candidates ride the browser's attach socket and the runner
  link, the two channels already authenticated (a single-use ticket and
  the pinned per-host link). The DTLS fingerprints in them are what bind
  the data channel to those two ends; no new credential exists.
- **ICE servers are the control plane's to hand out.** A STUN responder
  runs beside the API on the deployment's host (UDP 3478), and the list
  reaches both ends in the signalling messages, so a deployment can point
  at others without a release. No third-party STUN by default: a reader's
  address is not sent to a company that is not party to the session.
- **Same-machine and same-LAN readers connect over host candidates.**
  Browsers hide local addresses behind mDNS `.local` names; pion resolves
  them. This is the case that goes from ~100 ms to ~1 ms.

### Switching paths loses no byte

- **The runner owns the switch, with a marker on the old path.** When the
  data channel opens, the runner queues an `attachment.path { path:
  "direct" }` on the link behind every PTY frame it has already queued
  there, and sends every later byte on the data channel only. The browser
  writes relay bytes until it reads that marker, and holds data-channel
  bytes until then. Input moves the same way the other way: the browser
  sends its own marker on the attach socket and then types on the channel;
  the runner holds channel input until the marker arrives on the link. No
  sequence numbers: each side has one sender per direction, and each
  marker is ordered behind what came before it on its own path.
- **Falling back heals the screen instead of resending.** If the data
  channel closes, the runner goes back to the link and asks tmux to
  redraw that client (`refresh-client`). Every attachment is its own tmux
  client (02 §6), so a full repaint costs one screen of bytes and repairs
  whatever the closed channel did not deliver; the browser sees one
  redraw, never a cut escape sequence. A runner keeps no replay buffer for
  this.
- **The credit window carries over.** Credit (01, "Flow control") keeps
  its meaning on the direct path and is sent on the channel; the runner
  also waits on the channel's `bufferedAmount`, so a slow reader stalls
  its own pane and never the runner's memory.

### Authorization does not move

- **Attach is still the relay's decision.** A direct path is only ever
  offered for an attachment the relay has already admitted from a ticket,
  and the runner answers an offer only when it names an attachment the
  control plane opened on that link. Nothing reaches a runner directly
  without first passing 08 and 21.
- **Ending an attachment ends its channel.** The relay's minute re-check
  (21) and every detach already free the attachment with `session.detach`;
  the runner closes the PTY and now the channel with it. Revocation needs
  no new message.
- **Read-only is the runner's to hold on the direct path.** The relay drops
  a watcher's keystrokes today (21); on the direct path they never reach
  the relay, so the runner's own two layers carry it: it drops the
  attachment's input frames, and tmux runs the client `-f read-only`. Both
  exist today. A runner that cannot hold it never gets a direct path: the
  path is offered only to a runner whose `hello` names the `attachment.direct`
  capability, which ships after both layers.
- **The relay stops seeing terminal bytes** on the direct path: DTLS is
  end to end. Nothing on the control plane reads PTY output (agent state is
  the runner's, 02 §9), so nothing is lost by it.
- **"No inbound ports" still holds.** ICE punches out through the host's NAT
  for one negotiated peer at a time; nothing listens for strangers. The
  security checklist (07) gains the line: the runner answers ICE only for
  credentials it received over its link, and drops a data channel whose
  DTLS fingerprint is not the one signalled.

### Several browsers

- **Each browser is its own attachment, and so its own channel.** That is
  today's shape (a laptop and a phone on one pane are two tmux clients),
  and terminal output is kilobytes a second, so a host serves a handful of
  direct readers without noticing.
- **A host caps its direct peers** (eight to start), and every reader past
  the cap stays on the relay. A share link whose audience is `anyone` (21)
  stays on the relay: it is the audience that could be large, and a host's
  upload is somebody's home connection.
- **A large audience is the relay's job, later**, by fan-out: one read-only
  attachment from the host, its bytes copied by the relay to every watcher,
  with a `refresh-client` when one joins so it starts from a whole screen.
  The relay is already shaped for it; nothing here forecloses it.

## The wire (additions to 01)

On the attach socket (browser ↔ relay), JSON text frames:

| Message | Direction | Carries |
|---|---|---|
| `direct.offer` | browser → relay | the SDP offer, the data channel already created |
| `direct.answer` | relay → browser | the runner's SDP answer and the ICE servers |
| `direct.candidate` | both | one trickled ICE candidate |
| `direct.unavailable` | relay → browser | why there is no direct path (capability, cap, audience, policy); the attachment stays on the relay |
| `attachment.path` | both | the switch marker, `direct` or `relay` |

On the runner link, the same four keyed by `attachmentId`:
`attachment.direct.offer`, `attachment.direct.answer`,
`attachment.direct.candidate`, `attachment.path`. They are sent only to a
runner whose `hello` names `attachment.direct`, and a runner that predates
them is never asked. Schemas go in `packages/shared/src/protocol/` like the
rest, with the Go twin generated (01, open question 1).

## Order of work

0. **Measure and predict** (built, above).
1. **Signalling and the direct path for the reader's own panes**, behind a
   `terminal_direct_path` release flag: the protocol messages, the STUN
   responder, pion in the runner, the switch markers, the browser's
   channel next to its socket. The latency readout says which path a pane
   is on (`direct` / `relay`).
2. **Fallback and recovery**: the channel closing, ICE restarting after a
   network change (a laptop moving from Wi-Fi to a phone's hotspot), the
   `refresh-client` repaint, and the e2e spec that kills a channel in the
   middle of output and finds the screen whole.
3. **Share links**: direct for `people` and `accounts` audiences up to the
   host's cap; `anyone` stays relayed.
4. **Later**: relay fan-out for large read-only audiences.

Each step's gate is the readout's number: a reader on the same LAN as the
host under 10 ms median echo, and no reader slower than the relay path
would have been.

## Open questions

1. **Where the STUN responder runs**: in the API process (pion has a STUN
   server), or as its own small container in `docker/` beside it. Own
   container recommended: the API scales by replicas and STUN does not
   need to.
2. **Whether the browser offers or the runner does.** Browser recommended:
   the browser knows when it wants a direct path (a visible pane), and a
   runner offering to every attachment would punch for panes nobody looks
   at.
3. **Mobile networks.** A phone on a carrier's symmetric NAT will usually
   not connect directly and stays on the relay. Whether that is worth a
   TURN server near the reader (not near the relay) is a question for
   after the readout shows how often it happens.
4. **Whether the direct path makes predictive echo redundant on a LAN.** The
   30 ms threshold already stops it drawing there; whether to stop
   tracking too is a measurement, not a decision.
