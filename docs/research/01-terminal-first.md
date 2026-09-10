# 01 — Terminal-first: how Orca does it and what we take

Decision from discussion: the core primitive is a **real terminal in the
browser**, not an SDK-driven chat. You open a terminal on a chosen machine,
log in to `claude` or `codex` inside it, and work. Any agent that runs in a
terminal is supported by construction. This supersedes the "Agent SDK, not
shelling out" decision in `00-vision-and-plan.md`.

## 1. How Orca's terminals work

Orca is an Electron app (React + Vite, pnpm monorepo). What makes its
remote terminals feel local is not the terminal widget. It is the daemon
model behind it.

### Renderer

- xterm.js with the **WebGL addon** (GPU rendering, no CPU bottleneck on
  heavy output), plus fit and search addons.
- Lazy mounting: only the active worktree's terminals are attached
  ("cold park" the rest), so a fleet of 30 sessions does not cost 30 live
  renderers.
- Reattach restores the screen from a **retained output buffer** on the
  daemon side, so a pane never shows blank after a reconnect.

### Remote: the relay daemon

On first connect Orca ships a small Node package to the host over SSH and
launches it. Everything after that goes through the relay:

- **Protocol**: JSON-RPC 2.0 with notifications for streaming, multiplexed
  over one SSH exec channel (`SshChannelMultiplexer`). Requests for git,
  filesystem, port scanning, and PTY I/O share one connection.
- **PTYs**: `node-pty` spawned by the relay, output captured in a
  `RecentPtyOutputBuffer` so a reconnecting client can replay the tail.
- **Survival**: PTYs are owned by the daemon, not by the SSH session. When
  the channel drops, the daemon keeps them alive for a configurable grace
  period and reattaches via a Unix domain socket. "Disconnects don't
  terminate agent sessions."
- **Reconnect**: state machine (disconnected → connecting → connected →
  reconnecting) with an exponential backoff ladder.
- **Extras on the same channel**: port scanner broadcasts remote listeners
  for one-click forwarding; agent hook server receives status updates from
  the CLI agents (done / waiting for input) for the board.

### Known pain points (from their issues and docs)

- `node-pty` is native. On Linux hosts without a C++ toolchain the relay
  cannot build it and remote terminals silently do not work. Their fix is
  "apt-get install build-essential". Ours should be shipping prebuilt
  binaries per platform.
- Blank remote pane when the client starts while the host is unreachable
  (issue #18495). Reconnect UX is where the bugs live.

## 2. What is different for a web product

Orca's client is Electron, so the daemon talks to a local main process over
SSH. Our client is a browser tab, so the topology inverts:

```
browser (xterm.js + WebGL)
   │  WebSocket (binary frames for PTY bytes, JSON for control)
   ▼
control plane  ── routes by session id ──►  runner daemon on target
                                             node-pty · output ring buffer
                                             PTY survives client + link loss
```

- The browser never talks to the target directly. The control plane is a
  dumb relay for PTY bytes plus the owner of auth and session metadata.
- The runner dials **out** to the control plane, so the Mac Studio behind
  a home router works with zero SSH setup. This replaces Orca's
  SSH-install step with "run one install command on the machine once".
- Sessions survive everything except the daemon itself: close the tab,
  lose wifi, come back from a phone, the PTY is still there and you get
  the buffered tail. Optional: back each PTY with `tmux` so even a daemon
  restart is survivable. tmux is the safest first implementation and can
  be replaced by our own PTY ownership later.

## 3. What "the same experience" needs, concretely

Latency and feel come from five things. All are known engineering, none
are research:

1. **Binary WebSocket frames end to end** for PTY data. No JSON wrapping,
   no base64. One frame per PTY read.
2. **Flow control**: the browser acks consumed bytes and the runner pauses
   the PTY read when the ack window is exhausted, otherwise `yes` or a
   noisy build floods the tab. xterm.js exposes write callbacks for this.
3. **Resize** propagated immediately (cols/rows to `pty.resize`) and
   coalesced during drags.
4. **Output ring buffer** on the runner (a few MB per session) so reattach
   replays the tail, plus xterm.js serialize addon on the client for
   scrollback that survives page reloads.
5. **Reconnect ladder** with the pane showing its last frame, never blank.

Nice to have, straight from Orca: split panes, tab groups per worktree,
search, clickable file paths and URLs, port-forward tab, and an agent
status hook so the board shows "waiting for input" without parsing output.

## 4. Login inside the terminal

Because the agent runs as a normal process in the PTY, `claude` and
`codex` login exactly as they do on a laptop. Two things make this
painless on a headless target:

- The device-code / URL login flow prints a link. The web UI detects URLs
  in terminal output and makes them clickable, so you complete OAuth in
  another tab. This is the whole "login" feature for the MVP.
- Credentials land in the target's home directory (`~/.claude`,
  `~/.codex`). They belong to the machine, not to the platform. The
  platform's secret vault is for repo/project secrets (tokens, `.env`),
  injected as env vars when the shell starts.

## 5. Revised layering

| Layer | MVP | Later |
|-------|-----|-------|
| Terminal | xterm.js WebGL, binary WS, reattach, splits | serialize scrollback, search, links |
| Runner | node-pty + tmux-backed sessions, outbound WS, ring buffer | own PTY ownership, prebuilt binaries |
| Workspace | git worktree per session | Docker per session, microVM |
| Agents | none built in: whatever you type | status hooks, "new session with prompt" |
| Board | list of sessions per project/target with live status | delegation via a small MCP server |
| Secrets | env injection at shell start | scoped, scrubbed |

The Agent SDK is not gone. It becomes an optional, later feature for
non-interactive runs (webhook → task → PR) where nobody is watching a
terminal. The terminal is the product; the SDK is an automation add-on.

## 6. What to prototype first

One evening, no UI polish:

1. `apps/runner`: Node, `node-pty`, connects to a WS server, spawns
   `tmux new -A -s <id>` per session, streams bytes, resizes, keeps a
   ring buffer.
2. `apps/control`: WS hub that pairs browser sockets to runner sockets by
   session id and replays the ring buffer on attach.
3. `apps/web`: one page, xterm.js + WebGL addon, "new terminal on
   <target>" button.

Then run `claude` in it from a phone browser, close the laptop, and check
the session is still there in the morning. If that feels as smooth as
Orca over SSH, the rest is UI.

## Sources

- Terminal system: <https://deepwiki.com/stablyai/orca/5-terminal-system>
- SSH and remote connections: <https://deepwiki.com/stablyai/orca/2.5-ssh-and-remote-connections>
- SSH worktree docs: <https://www.onorca.dev/docs/ssh>
- Repo: <https://github.com/stablyai/orca>
- Blank-pane reconnect issue: <https://github.com/stablyai/orca/issues/18495>
