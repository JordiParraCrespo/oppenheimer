# 07 — The MVP

Everything in notes 00 to 06 is the map. This is the first thing we
ship. The rule for what goes in: it must be needed to make the demo
scene below true, on your own machines, with your own accounts.

## 1. The demo scene

You open the site on your phone at a café. You see two targets online:
`mac-studio` at home and `hetzner-1`. You open project `oppenheimer`,
click **New session on mac-studio**, and a terminal appears in under two
seconds, already in a fresh worktree on the `main` branch, with your
"work" Claude account selected. You type `claude`, give it a task, and
close the phone. On the train you open the laptop, the session is still
running, the board says **blocked: waiting for approval**, you approve
in the terminal. At home you click **Create PR**. The next morning you
start three sessions on `hetzner-1` for three issues, using the Claude
account with the most headroom, and watch them side by side.

That scene needs exactly what follows and nothing else.

## 2. In and out

| In the MVP | Out, on purpose |
|------------|-----------------|
| Direct-mode targets (mode A) on macOS and Linux | Isolated VMs (mode B), Firecracker, tart, cloud adapters |
| Persistent terminal in the browser, reattach, splits | Editor, embedded browser, diff annotations |
| Git worktree per session, branch `nation/<slug>-<id>` | Docker isolation, secret scrubbing of output |
| GitHub App login, "any repo you can see", clone, push, Create PR | Auto-fix, PR event subscriptions, routines, webhooks |
| Accounts per provider per target, add via login in terminal, per-session selection | Usage meters, "most headroom" routing, config mirroring |
| Board with session state from screen manifests (Claude Code, Codex, generic shell) | Delegation MCP server, multi-agent primitives |
| Actions-style target registration (token, keypair, outbound WS) | Signed auto-update, Tailscale mode, egress proxy |
| Single user, single org, GitHub OAuth login | Multi-tenant, billing, sharing |
| Postgres, one control-plane process, one Go runner binary | Relay split, horizontal scaling |

The GitHub token still never touches the target in the MVP: the runner
gets a per-session installation token from the control plane and passes
it to git through a credential helper bound to that session's shell.
The full egress proxy comes with mode B.

## 3. Screens

Five screens. Everything else is a modal.

1. **Targets.** List with online dot, OS, mode, accounts on it. "Add
   target" shows the one-line install command with the one-hour token.
2. **Project.** Repo, default branch, default target, default account per
   provider. "New session" button.
3. **Board.** Every session across projects as cards: project, target,
   branch, state chip (working / blocked / done / idle), last line of
   output, elapsed time. Click to open.
4. **Session.** The terminal, full-bleed, with a thin top bar: target,
   branch, account chips, state, **Create PR**, split, close. Login URLs
   printed by the CLI become a button. Reattach replays the tail.
5. **Accounts.** Per provider: label, target, status. "Add account" picks
   provider and target and opens a session running the login.

## 4. Components and what each must do

**`apps/web`** (Next.js): the five screens, xterm.js with WebGL and fit
addons, binary WebSocket to the relay with a per-session ticket, resize
and flow-control acks, link detection restricted to vendor login hosts.

**`apps/control`** (Node, Hono, Drizzle, Postgres), one process:

- identity: GitHub OAuth login, one user.
- fleet: registration tokens, RSA public keys, clientIds, heartbeats.
- scheduler: session create → pick target → send job, encrypted to the
  runner key.
- relay: pairs browser sockets to runner sockets by session id, verifies
  tickets, replays the ring buffer on attach.
- github: App auth, installation token minting per session (repo-scoped,
  1 h), Create PR endpoint that reads the repo's PR template.
- events: append-only log per session, SSE to the board.

**`apps/runner`** (Go, single static binary, launchd/systemd unit):

- registration and boot handshake, outbound WebSocket, reconnect ladder.
- sessions: create worktree, spawn `tmux new -A -s <id>` with a PTY,
  set env (`CLAUDE_CONFIG_DIR`, `CODEX_HOME`, `GIT_*`, credential helper
  for the session token), stream bytes, resize, ring buffer, tail replay.
- screen manifests for Claude Code, Codex, and a generic shell → state.
- accounts: create account dir, run login, detect credential file
  appearing, report status.
- credential helper: a tiny subcommand git calls that returns the
  session's GitHub token from the runner over a Unix socket.

**`packages/protocol`**: JSON Schema for registration, heartbeat, job,
PTY frames, state events. Generated types for both TypeScript and Go.

## 5. Order of work

Each step ends with something you can use. Estimates are for one
person working steadily; treat them as relative sizes.

| Step | You can now | Size |
|------|-------------|------|
| 1 | Run the runner on your Mac, open one page, get a tmux-backed terminal, close the tab, reopen, it is still there | 1 week |
| 2 | Register a target with the token flow, see it on the Targets screen, open a session from the board | 1 week |
| 3 | Log in with GitHub, add a project, sessions start in a worktree on a branch, push works with the per-session token | 1 week |
| 4 | Board shows working / blocked / done from screen manifests; login URLs are buttons | 3 days |
| 5 | Accounts: add a Claude and a Codex account on a target, pick per session | 3 days |
| 6 | Create PR from the session bar, template-aware | 2 days |
| 7 | Splits, reattach polish, reconnect ladder tests, phone layout | 1 week |

About five to six weeks to the demo scene, with the terminal feel
proven in week one. If step 1 does not feel like Orca over SSH, stop
and fix that before step 2.

## 6. Done means

- The demo scene runs end to end on a real Mac Studio and a real Linux
  server, from a phone browser.
- Closing the browser, losing wifi, and restarting the runner do not
  kill a session (the last one via tmux).
- No GitHub token, Claude credential, or Codex credential is ever stored
  by the control plane. Verified by grepping the database and the
  control-plane logs after a full run.
- Two sessions on one target run two different Claude accounts at once.
- A cold `git clone` of the repo plus `docker compose up` brings up the
  control plane and web app on a fresh machine.

## 7. First thing after the MVP

Mode B on one Linux host, because it is the piece that turns "my
machines" into "as many machines as I want", and because everything
security-critical in note 04 lands with it: egress proxy, proxy-injected
tokens, jailed VMs, persistent home volumes. Then usage meters and
auto-fix, in that order.
