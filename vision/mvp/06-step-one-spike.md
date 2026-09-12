# 06 — Step-one spike

## Goal

A tmux-backed terminal on the Hetzner host, streamed to one browser
page, that survives closing the tab, losing wifi, and restarting the
runner. Judged by feel and by a number.

## Build

- `runner` command in the existing Go module: spawn `tmux new -A -s
  <id>`, attach a PTY, stream bytes over one outbound WebSocket to a
  tiny relay, resize, ring buffer of a few MB, tail replay on attach,
  reconnect ladder with an epoch counter.
- Tiny relay: pairs one browser socket to one runner socket by session
  id. No auth beyond a shared secret for the spike.
- One page: xterm.js with the WebGL, fit, and unicode11 addons. Binary
  frames. Flow control acks. A status line showing keystroke echo
  latency, measured by timestamping a keystroke and its echo.

## Gate

- Echo under 50 ms median from Barcelona on wifi with the relay in the
  same Hetzner region as the host.
- Close the tab, reopen: same screen, cursor where it was.
- Kill the runner, restart it: session still there via tmux.
- Run `codex` in it from a phone browser and give it a task.

## Open questions

1. Where the relay runs for the spike: on the host itself (zero hops,
   answers only the terminal question) or on a cloud VM in the same
   region (answers the real topology). Recommendation: both, one day
   each, and record both numbers.
2. Whether to try local echo prediction in the spike or leave it for
   later. Recommendation: measure without it first.
