# 22 — The direct terminal path

A session's terminal reaches the browser straight from the host, over
WebRTC, with the relay as the path it starts on and falls back to. Asked
for on 2026-10-11 ("I want the sessions to be p2p … performance of the
sessions is a top priority", then "Yes I love WebRTC", and, on moving the
relay closer: "when I travel I will still have this problem"). This note
records the direction, the shape, and the order it is built in. Steps 0
and 1 are built, the fallback of step 2 with them; "As built" below says
what changed on the way, and every changed point says so where it stands.

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
  (Claude Code, like every Ink program). While a guess is drawn the
  terminal's own cursor is hidden, so the reader sees one cursor, the
  predicted one, and not the host's trailing a few keys behind it. It draws only above 30 ms of
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
  channel, so no 4-byte header). Unordered or unreliable delivery is never
  used: a lost or reordered PTY byte cuts an escape sequence (01).
  *Changed while building (2026-10-11):* this said the channel's text
  messages carry the attachment's credit and resize. It carries **binary
  only**; credit and resize stay on the attach socket, which needed no
  second control vocabulary and loses nothing (neither is on the typing
  path).
- **Every attachment opens on the relay and moves to the direct path once
  it is up.** The first frame never waits on ICE, a network that cannot
  connect directly is no slower than today, and the relay *is* the
  fallback. There is no TURN server: one on the Hetzner box would be the
  same detour as the relay, through a second service. This is how Tailscale
  moves from DERP to a direct path.
- **The control plane is the signalling channel.** The offer and the
  answer ride the browser's attach socket and the runner link, the two channels already authenticated (a single-use ticket and
  the pinned per-host link). The DTLS fingerprints in them are what bind
  the data channel to those two ends; no new credential exists. *Changed
  while building:* no trickle ICE. Each side gathers its candidates (up to
  two seconds in the browser, three on the host) and sends one complete
  SDP, so there is no candidate message at all.
- **ICE servers are the control plane's to hand out.** The list reaches
  both ends in the signalling messages (`attached.direct.iceServers`, the
  link's offer), so a deployment changes it without a release. No
  third-party STUN by default: a reader's address is not sent to a company
  that is not party to the session. *As built:* the list is
  `RELAY_ICE_SERVERS`, empty by default, which is host candidates only
  (a reader on the host's machine or network). *Changed 2026-10-11:* the
  dev deployment names **Cloudflare's public STUN**
  (`stun:stun.cloudflare.com:3478`) instead of running its own (open
  question 1). The reason against a third party does not hold for this one:
  every request already reaches Cloudflare through the tunnel, so a reader's
  address goes to no company it did not already reach. A responder of our
  own would need UDP 3478 published on the server, which breaks the
  deployment's rule that nothing publishes a port (`deploy/dev/compose.yml`).
  It is free, as STUN generally is (TURN is what is billed).
- **Same-machine and same-LAN readers connect over host candidates.**
  Browsers hide local addresses behind mDNS `.local` names; pion resolves
  them. This is the case that goes from ~100 ms to ~1 ms.

### Switching paths loses no byte

- **Each direction switches at a byte offset, said on the control path.**
  When the data channel opens, the runner counts the PTY bytes it has
  handed to the link, sends every later byte on the channel only, and
  tells the browser the count (`attachment.path`, then `direct.path`). The
  browser draws relay bytes until it has that many, holding channel bytes
  until then. Input moves the same way the other way: on the channel's
  open the browser sends the count of keystroke bytes it typed on the
  relay and types on the channel from then on; the runner holds channel
  input until the link has delivered that many.
  *Changed while building (2026-10-11):* this said a **marker** on the old
  path, queued behind the bytes before it. The link's writer sends every
  control frame ahead of queued PTY frames (01, "Flow control"), so a
  marker sent as a control message could overtake the very bytes it stood
  behind; a count cannot be overtaken.
- **Falling back heals the screen instead of resending.** If the data
  channel closes, the runner goes back to the link in both directions and
  asks tmux to redraw that client. Every attachment is its own tmux client
  (02 §6), so a full repaint costs one screen of bytes and repairs whatever
  the closed channel did not deliver; the browser sees one redraw. A runner
  keeps no replay buffer for this. The browser needs no message for it:
  output arriving on the relay after its switch means the host fell back,
  and it follows. The attachment stays open throughout: closing it would
  reach the browser as "session gone", which it takes as final.
  *Changed while building:* the redraw is a `SIGWINCH` to the
  attachment's own `tmux attach` process rather than `refresh-client`,
  which needs the client's name, and the runner never kept one. The client
  reports its unchanged size and the server repaints it in full; the window
  and the program in it see nothing. A test against real tmux proves the
  repaint, and fails without the signal.
- **The credit window carries over.** Credit (01, "Flow control") keeps
  its meaning on the direct path, and the browser still sends it on the
  attach socket for every chunk it draws, whichever path carried it; the
  runner also waits on the channel's `bufferedAmount` (1 MiB, until it
  drains to 256 KiB), so a slow reader stalls its own pane and never the
  runner's memory. A fallback forgets the bytes that were in flight on the
  channel, which will never be credited.

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
  security checklist (07) gains the line (F29): the runner answers ICE only for
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
  upload is somebody's home connection. *As built (step 1):* no share link
  is offered a direct path, whatever its audience; step 3 opens it to
  `people` and `accounts`.
- **A large audience is the relay's job, later**, by fan-out: one read-only
  attachment from the host, its bytes copied by the relay to every watcher,
  with a `refresh-client` when one joins so it starts from a whole screen.
  The relay is already shaped for it; nothing here forecloses it.

## The wire (additions to 01)

As built. *Changed while building:* the table first listed a trickled
`direct.candidate` and a switch marker; there is neither (above).

On the attach socket (browser ↔ relay), JSON text frames
(`packages/shared/src/protocol/attach.ts`):

| Message | Direction | Carries |
|---|---|---|
| `attached.direct` | relay → browser | present when a direct path is on offer: the ICE servers to gather with |
| `direct.offer` | browser → relay | the SDP offer, every candidate in it, the `pty` channel already created |
| `direct.answer` | relay → browser | the runner's SDP answer |
| `direct.unavailable` | relay → browser | why there is none (the runner refused, the host's cap, an offer that was not invited); the attachment stays on the relay |
| `direct.path` | both | a byte offset: from the relay, where the output moved; from the browser, where its input did |

On the runner link (`packages/shared/src/protocol/messages.ts`, the Go
generated from it), keyed by `attachmentId`: `attachment.direct.offer`
(with the ICE servers), `attachment.direct.answer`,
`attachment.direct.refused`, and `attachment.path` in both directions. They
are sent only to a runner whose `hello` names `attachment.direct`, and a
runner that predates them is never asked.

The relay offers a direct path when the runner names the capability, the
`terminal_direct_path` release flag is on for the person (checked by the
relay as well as the console), and the attachment did not come through a
share link. It forwards one offer per attachment and nothing it did not
invite.

## Order of work

0. **Measure and predict** (built, above).
1. **Signalling and the direct path for the reader's own panes**, behind a
   `terminal_direct_path` release flag: the protocol messages, pion in the
   runner, the switch offsets, the browser's channel next to its socket.
   The latency readout says which path a pane is on (`direct` / `relay`).
   **Built**; STUN is Cloudflare's (open question 1).
2. **Fallback and recovery**: the channel closing (**built**: back to the
   link, repainted), ICE restarting after a network change (a laptop
   moving from Wi-Fi to a phone's hotspot; not built: today the channel
   closes and the pane carries on through the relay), and the e2e spec
   that kills a channel in the middle of output and finds the screen whole
   (proven by hand, below; not yet a committed suite).
3. **Share links**: direct for `people` and `accounts` audiences up to the
   host's cap; `anyone` stays relayed.
4. **Later**: relay fan-out for large read-only audiences.

Each step's gate is the readout's number: a reader on the same LAN as the
host under 10 ms median echo, and no reader slower than the relay path
would have been.

## As built: step 1 (2026-10-11)

- `apps/runner/internal/direct` answers an offer with pion and carries one
  `pty` channel per attachment; `internal/cli/link_direct.go` moves the
  bytes, holds early channel input, and falls back. Tests in both run real
  pion peers in-process, under the race detector.
- The relay (`browser-attach.gateway.ts`) decides the offer and forwards
  the signalling; the console's stream (`direct-path.ts` beside
  `session-stream.ts`) offers, switches at the offsets, follows a
  fallback, and stops trying for the rest of its life after two failed
  channels.
- Proven end to end by hand, not in CI: headless Chromium running the
  console's own stream code, the real relay, the real runner binary and
  tmux. The pane moved from the relay to the channel by itself; a typed
  command and its output crossed the channel with **no byte on the
  relay**; keystroke-to-echo over the channel was **4.1–4.3 ms** on one
  machine; closing the browser's peer connection put the pane back on the
  relay, repainted, and typing went on.

## Open questions

1. ~~**Where the STUN responder runs**~~. **Decided 2026-10-11: nowhere of
   ours.** The dev deployment uses Cloudflare's public STUN (above), so the
   server keeps publishing no port. A responder of our own stays possible
   (pion has one) if a deployment ever cannot use Cloudflare's; it would be
   its own small container publishing UDP 3478, and an exception to the
   deployment's port rule.
2. ~~**Whether the browser offers or the runner does.**~~ **Decided: the
   browser**, once the relay's `attached` invites it: the browser knows when
   it wants a direct path, and a runner offering to every attachment would
   punch for panes nobody looks at.
3. **Mobile networks.** A phone on a carrier's symmetric NAT will usually
   not connect directly and stays on the relay. Whether that is worth a
   TURN server near the reader (not near the relay) is a question for
   after the readout shows how often it happens.
4. **Whether the direct path makes predictive echo redundant on a LAN.** The
   30 ms threshold already stops it drawing there; whether to stop
   tracking too is a measurement, not a decision.
