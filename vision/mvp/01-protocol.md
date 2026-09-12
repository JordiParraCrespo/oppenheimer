# 01 — Protocol

## Decided

- Three parties: browser, control plane, runner. The runner dials out.
  The browser never reaches the runner directly in the MVP (the direct
  tailnet path is later).
- PTY bytes travel as binary WebSocket frames, one frame per PTY read,
  no JSON wrapping. Control messages are JSON on the same socket.
- The browser attaches to a session with a single-use, seconds-lived
  ticket minted by the API after an ownership check (note 04 F1).
- The runner authenticates with a registration token once, then a
  keypair-signed JWT per boot (note 03 §2). Job payloads are encrypted
  to the runner's key (F7).
- Attach tickets and runner responses can carry structured hints:
  blocked with retry-after, update required (note 12).
- Flow control: the browser acks consumed bytes; the runner pauses the
  PTY when the window is exhausted.
- Screen-manifest state changes and agent session ids flow runner to
  control plane as events.

## Open questions

1. Schema language for the shared package: JSON Schema with generated
   TypeScript and Go, or protobuf. Both languages must generate from
   one source.
2. One WebSocket per session from the browser, or one per tab with
   session multiplexing? Multiplexing is fewer sockets on a phone but
   more framing.
3. Runner to control plane: one WebSocket carrying all sessions
   multiplexed, or one per session? One multiplexed link is the natural
   fit for the tailnet.
4. Heartbeat interval and what it carries: host load for the overcommit
   cap, disk pressure, per-session state, account status.
5. Token rotation message for the guest's git credential helper: pushed
   by the control plane on a timer, or requested by the runner before
   expiry?
