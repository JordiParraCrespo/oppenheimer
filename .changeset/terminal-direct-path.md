---
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
---

A session's terminal can take a direct path to its host
(`product/versions/mvp/22-direct-terminal-path.md`), behind the new
`terminal_direct_path` release flag.

- `@oppenheimer/runner`: answers a browser's WebRTC offer with pion and
  carries the attachment's bytes on one ordered `pty` data channel, at most
  eight per host; switches each direction at a byte offset; falls back to the
  link when the channel closes, with the tmux client repainted. The hello
  names `attachment.direct`.
- `@oppenheimer/api`: the relay offers a direct path (with
  `RELAY_ICE_SERVERS`) to a runner that can answer, for a person the flag is
  on for, outside share links, and forwards the offer, answer, refusal and
  offsets.
- `@oppenheimer/frontend-consumer`: the attach stream opens the data channel
  beside its socket when invited, switches at the offsets, follows a
  fallback, and stops trying after two failed channels; `onPath` says which
  path the bytes take.
- `@oppenheimer/web`: the latency readout names the path.
- `@oppenheimer/shared`: the signalling messages on both sockets, the
  `attachment.direct` capability and the `terminal_direct_path` flag.
