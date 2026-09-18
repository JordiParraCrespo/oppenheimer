# 01 — Protocol

## Decided

- Three parties: browser, control plane, runner. The runner dials out.
  The browser never reaches the runner directly in the MVP (the direct
  tailnet path is later).
- PTY bytes travel as binary WebSocket frames, one frame per PTY read,
  no JSON wrapping. Control messages are JSON on the same socket.
- On the runner's link, where sessions share one socket, a binary frame
  is a 4-byte big-endian stream id followed by the bytes — the minimum
  multiplexing needs, and still no JSON and no base64 around the payload
  (02 §4).
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
3. ~~Runner to control plane: one socket or one per session?~~ Decided:
   one multiplexed link per host, stream id in the frame header
   (02 §4).
4. ~~Heartbeat interval and what it carries~~: decided, every 15 s with
   per-session state, host load, free disk, the versions of `git`,
   `tmux` and `claude`, and the update channel; the reply may carry
   `update_available`, `update_required` or `blocked` hints (02 §4,
   09 §6).
5. ~~Token rotation for the git credential helper~~: decided, the runner
   pulls a fresh token before expiry because it is the side that knows
   when the token will be used; the control plane may push a revoke
   (02 §8).
6. Whether the runner's link and the browser's attach socket share one
   message schema or two. They already share the hint vocabulary; the
   answer follows open question 1.
