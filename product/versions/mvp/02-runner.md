# 02 — Runner

The host agent. One Go binary, installed as your own user on a machine
you own, that turns that machine into a place sessions run: it holds one
outbound connection to the control plane, owns the git worktrees, owns
the tmux server the sessions live in, and streams their terminals. It
opens no port and never runs as root.

Installing it and keeping it current are their own document:
[09 — Runner install and update](09-runner-install-and-update.md).

## Decided

### 1. Shape of the process

- **One binary, one long-lived process, no inbound port.** The daemon
  dials out to the control plane over a single WebSocket and keeps it
  open. Everything the browser asks for arrives on that link; nothing
  reaches the host from outside (00 §"No ports on the host, ever").
- **The only local listener is a Unix socket**, `~/.oppenheimer/run/runner.sock`,
  mode 0600, owned by the user. It answers the git credential helper and
  the read-only queries `status` uses.
- It is **its own small router**, not the template's API bound to a
  socket. `httpx` and `problem` are reused for the middleware and the
  error documents; `apikeys`, the scope guards, the bearer middleware
  and `/v1/ws` are not mounted on it and must never be. A host agent
  that exposes nothing should not carry a copy of the control plane's
  inbound surface, and the way to keep that true is to keep the route
  list short enough to read: health, host facts, sessions, updates, and
  the credential lookup.
- There are no scopes on that socket. It is 0600 and the caller is the
  same uid; a bearer model taped onto filesystem permissions would be
  ceremony. If a local client ever needs to be told apart from another,
  that is when to add one.
- **One runner per host.** A `flock` on `~/.oppenheimer/run/runner.lock`
  makes a second start fail loudly instead of fighting over the tmux
  server and the worktrees.
- **The tmux server is a sibling, not a child.** The runner can die,
  restart or be replaced by a new version without touching a session
  (§6). That single fact is what makes updates cheap (09 §5).
- Runs as the user's own account: launchd user agent on macOS, systemd
  user unit with lingering on Linux. Never as root, never with sudo
  except the one optional package-manager step the installer asks about
  (F10, 09 §2).

### 2. Subcommands

One binary, one code path per job, so the installer, the service and the
user-facing diagnostics are the same artifact and the same version.

| Subcommand | Role |
|---|---|
| `run` | the daemon: link, sessions, tmux, worktrees, credential socket. What the service unit starts |
| `serve` | the control-plane-facing HTTP service on a TCP port, which is what the container image runs. The host agent is `run`, which opens no port |
| `register` | redeem a registration token: generate the keypair, send the public key and host facts, receive the host id and the control plane's key fingerprint, write `config.json` |
| `install` / `uninstall` | write, load and remove the launchd or systemd user unit; `uninstall` also revokes the host key |
| `status` | local diagnostics: link state, sessions, versions, preflight, disk. Exit codes are a contract, as in `apps/cli` |
| `credential-helper` | git's credential protocol on stdin/stdout, answered over the Unix socket (§8) |
| `update` | check, apply, pin or roll back a version (09 §5) |
| `selfcheck` | a staged binary proving it can parse the config and speak the protocol before it becomes the service (09 §5) |
| `version` | version, commit, build date, protocol range |

The research brief's `hypervisor`, `guest` and `proxy` subcommands
(note 03) arrive with the VM slice. Only `run` and its helpers are MVP.

### 3. Package map

The layout is `apps/runner`'s hexagon
([ARCHITECTURE.md](../../../apps/runner/ARCHITECTURE.md)). The runner has
three I/O surfaces — one outbound link, one 0600 Unix socket, one sibling
tmux server — and the contexts follow the aggregates, not the surfaces.

```
apps/runner/
cmd/runner/main.go          signals, flags, subcommand dispatch — no wiring
internal/
  cli/                      composition root of the subcommands (the host agent)
  server/                   composition root of `serve`, the template's HTTP service
  pairing/                  identity: registration token, host keypair, boot JWT
  sessions/                 the aggregate: worktree + tmux session + windows
    adapters/tmux git manifest state
  host/                     the inventory a preflight and a heartbeat report
  service/                  the launchd agent and the systemd user unit
  updates/                  channel, safe window, staging, health gate, rollback
  config/ scopes/           as today
packages/go/
  selfupdate/               verify a signed manifest, swap a binary atomically
```

**The link is a port, not a context.** The outbound socket, its reconnect
ladder and its epoch belong behind a `Link` interface that `sessions` and
`pairing` use; the transport adapter is wired by the composition root and
the message vocabulary is 01's. A context called `link` that owned command
dispatch and an event queue would be a second place where session
lifecycle lives.

`host` is a context because it has a rule — the order in which a host's
blocking conditions are reported, root before platform before tools
before disk — and an error catalog the installer, the CLI and the console
all render. It is a small one, and it should stay small: everything else
about a host is heartbeat payload.

`apikeys` is the template's inbound credential surface. It goes when the
link lands: what dies with it is the TCP listener, the `opr_` keys and
HS256 as the host's identity.

One error catalog per context, in `<ctx>/domain/errors.go`, and adapters
map their failures onto it: `TMUX_*` and `GIT_*` are how the tmux and git
adapters fail, and they live in `sessions`. `RUNNER_*` is the generic
layer every route shares, from `packages/go/core/problem`. Codes are
unique and documented, and `internal/arch/catalog_test.go` fails the
build when either stops being true.

### 4. The link to the control plane

The wire is [01](01-protocol.md): frame layout and the attachment id,
hello, heartbeat, the hint vocabulary, the command list, flow control,
the reconnect ladder, and which three calls are ordinary HTTPS instead.
What belongs here is what the runner does with it:

- It dials out and keeps one link open. Registration and release
  manifests are HTTPS and do not need it, which is what lets a runner
  the control plane refuses on protocol grounds still fetch the version
  that fixes it (09 §5).
- On connect it sends the snapshot of what it is holding, and lets the
  control plane reconcile. The runner keeps no durable outbox: a laptop
  that was shut for a week has nothing worth replaying, and a snapshot
  is both cheaper and less wrong.
- It pauses a PTY when an attachment's window is exhausted, so one
  runaway build stalls its own pane.
- It survives the link being down indefinitely. Sessions keep running;
  tmux does not care.

### 5. Sessions

A session is a worktree plus a tmux session plus its windows. Create, in
order, each step resumable because the previous one is observable on disk:

1. Ensure the mirror: `~/oppenheimer-ai/workspaces/<repo>/main` exists
   and is fetched (`git clone` the first time, `git fetch --prune`
   after), authenticated through the credential helper (§8).
2. `git worktree add worktrees/<slug>` from it, at a new branch off the
   chosen base by default.
3. `tmux new-session -d -s <id> -c <worktree>` on the dedicated socket,
   with the session's environment set once (§6).
4. Window 0 runs the agent; `claude` from the host's own installation
   and login. The login URL it prints is detected by the classifier and
   sent to the browser as a button, linkified only for known vendor
   hosts (F3).
5. The control plane hears `session.created` with the branch, the
   worktree path and the initial state.

Close pushes the branch if it has commits and a remote, then
`git worktree remove` and `tmux kill-session`. A dirty worktree does not
block the close: the runner commits nothing on the user's behalf, it
reports `dirty` and leaves the worktree, which the Restart path can pick
up again.

**Adoption on boot.** The runner lists tmux sessions on its socket,
adopts those the control plane's snapshot reconciliation confirms,
rehydrates each ring buffer from `capture-pane`, and kills the rest
after a grace period — only sessions whose name matches its own id
scheme, never a session the user created. **After a host reboot** tmux
is gone: every session shows stopped with a Restart button that
recreates window 0 in the same worktree, which survived.

**Caps.** 20 sessions per host by default, 2 MB ring buffer each, 32 KB
PTY read buffer, resize events coalesced over 50 ms.

### 6. tmux topology

One tmux server per host on a dedicated socket (`tmux -L oppenheimer`)
so it never collides with the user's own tmux. One tmux session per
oppenheimer session, named by the session id, created with
`new-session -d -s <id> -c <worktree>` and window 0 running the agent.
Each browser tab is a tmux window in that session (`new-window`), so
every tab has its own scrollback and resize, and a phone-sized tab does
not shrink the laptop's. Closing the session is `kill-session`. Working
directory, environment, and the credential helper socket are set once at
creation and inherited by every window. The runner attaches by spawning
a PTY running `tmux attach -t <id>:<window>` per browser connection, so
several devices can view one window; tmux sizes the window to the
smallest attached client, accepted for the MVP. The runner passes its
own tmux config: status bar off, mouse on, 50k scrollback, no prefix
key. State dots come from `capture-pane` on window 0 every few seconds,
which is also how the login URL is detected. The tmux server outlives
the runner, so a runner restart or upgrade loses nothing.

### 7. Terminal streaming

- One PTY per attached browser connection, one goroutine reading it,
  one writer per link stream, bounded queues everywhere — a client that
  cannot keep up is disconnected, never allowed to stall the runner
  (`packages/go/ws`'s rule, applied to streams).
- The **ring buffer** is per session window, a few MB, replayed as a
  tail on attach so a reopened tab is not blank. It lives in memory: it
  is a cache of tmux's own scrollback, not a second copy of record, and
  it is rehydrated from `capture-pane -e` on adoption. Nothing is
  written to disk (F12).
- Resize goes straight through to the tmux window, coalesced during a
  drag.

### 8. Git and credentials

- A `credential-helper` subcommand that git in the session's shell
  calls; it asks the runner over the Unix socket for the current
  one-hour installation token for that session's repository. The session
  id comes from the environment tmux set at creation, so a helper
  invoked from another shell gets nothing. Nothing on disk (F10).
- The runner **pulls** a fresh token from the control plane before
  expiry — it is the side that knows when the token is about to be used
  — and the control plane may push `credentials.revoke` to drop it early
  (01 open question 5).
- Tokens live in memory, scoped to one session and one repository
  (F21), and are never logged.

### 9. Screen manifests and state

- The classifier reads `capture-pane` on window 0 — every 1 s while a
  client is attached, every 10 s when none is — and maps the screen to
  working, blocked, done, idle or unknown (note 03 §1), plus the login
  URL. Claude Code's manifest first, Codex's next.
- **A manifest is one agent's rules, as data.** One JSON file per
  agent, carrying a schema, an agent id, its own version and the engine
  version it needs; each rule names the region it reads, the patterns
  that match, the substrings that veto it, and a priority so the
  highest match wins. A chain of ifs reports "working" for a session
  that is actually blocked, because the spinner frame is still on
  screen under the question (note 13 §1).
- **Regions** are `title`, `screen`, `bottom:N` and `top:N`. `title` is
  the terminal title the agent sets through an escape sequence, read
  with tmux's `#{pane_title}`, and it is the signal to trust: the agent
  controls it, and nothing a person types into their prompt can appear
  in it.
- **Manifests ship without a binary.** The runner bundles a set so a
  host with no control plane still classifies its sessions; anything in
  `~/.oppenheimer/manifests/` replaces a bundled file by agent id, which
  is how a fix for an agent's new spinner reaches hosts without a
  release, a signature and a rollout. A file that does not parse is
  skipped with a reason, never fatal.
- Where an agent has lifecycle hooks, the hooks are authoritative and
  the screen is the fallback; that half is still to build.
- The vendor-login allowlist stays in code, not in a manifest: what the
  console may turn into a clickable link should not travel over the
  network (F3).
- Idle is terminal silence **and** a manifest state that is not working,
  so a long unattended run is never called idle.
- State changes go to the control plane as events; the control plane
  derives the sidebar dot from them.

### 10. Host facts and health

Collected at register, on `host.preflight`, and summarised in every
heartbeat: OS and arch, `git`, `tmux` and `claude` presence and version,
free disk on the workspaces filesystem, load, runner version and
channel. Missing `claude` is a hint in the UI, not a refusal — a session
still opens and the install prompt appears in the terminal. Missing
`tmux` is fatal for sessions and the installer offers to fix it (09
§2). **Disk pressure** is a status event before a session fails to
write, not an error after (note 12).

### 11. State on disk

One tree, named here and pointed at from 09:

```
~/.oppenheimer/
  config.json          0600  control plane URL, host id, key fingerprint, channel, pin
  host.key             0600  the ed25519 private key (F8; rotation supported)
  state/sessions.json  0600  session id → worktree, branch, repo, agent
  state/update.json    0600  what the last update did, and how often it has booted
  manifests/                 agent manifests newer than the bundled ones (§9)
  bin/                       runner-<version> binaries and the `current` symlink (09 §5)
  run/                       runner.sock, runner.lock
  log/                       runner.log, rotated at 10 MB × 3
~/oppenheimer-ai/workspaces/<repo>/main and /worktrees/<slug>   the user's code
```

**The boot path trusts tmux.** It is the only one of the three that
cannot be stale: a tmux session either exists on our socket or it does
not. `state/sessions.json` is a cache that says which of those sessions
is which, and the control plane is the source of truth for what *should*
exist — which is a different question, and one the runner cannot ask
while the link is down.

So the runner never kills a session on boot. It adopts what tmux still
holds, marks the rest stopped, and **reports** a tmux session with our
prefix that no record claims rather than reaping it after a grace
period. Ending someone's session is a decision the control plane makes
with its own state in hand, not a side effect of a laptop booting
offline. Logs never contain PTY bytes or tokens.

### 12. Failure modes

| Situation | What the runner does |
|---|---|
| Link down | Sessions keep running in tmux. Reconnect ladder, new epoch, snapshot on hello |
| Control plane says the runner is too old | Update within the urgent delay, ignoring the safe window (09 §5) |
| Runner killed or updated | tmux untouched; adopt on boot, rehydrate buffers, resume streams |
| Host rebooted | Sessions stopped, worktrees intact, Restart recreates window 0 |
| `tmux` missing | Sessions refuse to start with `TMUX_001`; the UI shows the fix |
| `claude` missing | Session starts; the terminal shows the install hint |
| Disk nearly full | Status event and a banner before the failure, refuse new sessions under the floor |
| Branch push rejected on close | Session closes, worktree kept, event carries the git error |
| A second runner starts | Fails on the lock with `RUNNER_001`, never a split brain |

### 13. Configuration

The daemon reads `~/.oppenheimer/config.json` (written by `register`) for
everything that identifies the host, and the repo's root `.env` only in
development, through `internal/config` as today. New variables get a note
in the root `.env.example` under "Runner (apps/runner)" when the code
lands; a paired host needs no environment at all, which is what lets the
service unit be three lines.

### 14. Deferred to the VM slice

Guest agent, vsock, libvirt lifecycle, sleep tiers, account volumes,
capacity gate, the egress proxy, and the `hypervisor`, `guest` and
`proxy` subcommands. None of it changes a boundary above.

## Open questions

1. ~~tmux topology~~: decided above, one server per host on its own
   socket, one tmux session per oppenheimer session, windows as tabs.
2. ~~Screen manifests: regexes or hooks?~~ Decided in §9 from note 13:
   hooks are authoritative where an agent has them, screen rules are the
   fallback, and the rules carry priorities and `not` guards. What is
   still open is the hook half — an agent that reports its own state
   should not be guessed at — and the delivery: the runner reads
   manifests from `~/.oppenheimer/manifests/`, and nothing writes there
   yet, because that is the control plane's side of the link.
3. ~~Idle detection input~~: decided in §9, silence **and** manifest
   state.
4. ~~macOS install~~: decided in 09 §2 — a user launchd agent and a
   quarantine-stripped binary need no notarization; only a `.app` would.
5. ~~Node and Claude Code presence~~: decided in §10 — check and hint for
   `claude`, installer fixes `tmux`.
6. ~~Package map~~: decided in §3.
7. Schema language for the link messages: JSON Schema generated to both
   languages, or protobuf (01 open question 1). The framing in §4
   works either way; the decision belongs to the protocol note.
8. Whether `sessions` should split into `sessions` and `workspaces` once
   the VM slice adds a second kind of place a worktree can live. Today
   git is an adapter of `sessions`; then it may want its own context.
