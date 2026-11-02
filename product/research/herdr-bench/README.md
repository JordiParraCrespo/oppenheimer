# herdr-core against the runner's tmux: the benchmark

What `../lessons-from-herdr.md` §4 quotes. One Go program drives three
terminal layers on the same machine and measures each the same way:

- **tmux (runner)**: tmux exactly as `apps/runner/internal/sessions/adapters/tmux`
  drives it: the runner's config verbatim, one `exec` per command,
  `tmux attach-session` on a PTY (creack/pty) read 32 KB at a time.
- **herdr-core**: the released `hc` binary over its own Unix socket: one
  long-lived plain JSON-RPC connection for commands, and a framed connection
  per viewer that hands back CREDIT for every byte it takes.
- **direct-pty**: the program on a PTY the benchmark owns. No multiplexer,
  no persistence: the floor.

Text is matched with escape sequences stripped, so a match is never a byte
inside a cursor move.

## Run it

```bash
# herdr-core's release, checked against its manifest's sha256
curl -fsSL https://releases.herdr.dev/core/latest.json
GOWORK=off go run . -hc /path/to/herdr-core -dir /tmp/herdr-bench -out results.json
GOWORK=off go run . -hc /path/to/herdr-core -dir /tmp/herdr-bench -quick -only echo,restart
```

Groups: `footprint`, `echo`, `throughput`, `attach`, `capture`, `create`,
`restart` (herdr-core's update restart and crash, and both layers' answer to
the OSC 7501 probe). herdr-core runs in a session of its own (`HC_SESSION`,
scratch XDG directories, its own socket) and never touches a real core.

`results.json` is the run of 2026-11-02 on a 4-vCPU Linux 6.18 container,
tmux 3.4, herdr-core 0.1.16. Its restart rows come from a rerun: in the
first full run the harness found herdr-core's processes by a relative path,
so its SIGKILL killed nothing; the rerun found them by absolute path.

Not measured: a browser, the WebSocket and the relay in the loop, and the
real runner in place of this harness's copy of its tmux calls.
