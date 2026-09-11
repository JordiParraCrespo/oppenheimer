# 07 — The MVP is sessions

Decision from discussion: the MVP is sessions, nothing else. A session
is a persistent terminal on one of your machines, opened from a browser,
that survives everything. If you can do a thing by typing in that
terminal, it is not in the MVP.

## 1. The scene

You open the site on your phone. You see `mac-studio` online. You click
**New session**, name it, and a terminal appears in under two seconds in
your home directory. You `cd` to a repo, type `claude`, log in by tapping
the URL it prints, give it a task, close the phone. On the laptop you
open the same session and it is still running. You run three more.

## 2. What is in

| Piece | What it does |
|-------|--------------|
| Runner | One Go binary on the target. Dials out over WebSocket with a target token. Spawns `tmux new -A -s <id>` under a PTY per session. Streams bytes, resizes, keeps a ring buffer, replays the tail on attach. Reconnect ladder. Survives its own restart via tmux. |
| Control plane | One process, Postgres. Login with GitHub OAuth or a single password. Targets with a token. Sessions: id, name, target, cwd, created, last seen. Relay that pairs browser sockets to runner sockets by session id with a per-session ticket. |
| Web | Two screens. **Sessions**: a list grouped by target with online dots and New session. **Session**: the terminal full-bleed with xterm.js WebGL, a thin bar with target, name, close, and login URLs turned into a button. Phone layout. |
| Install | `curl … | sh` that drops the runner and a launchd or systemd unit with the target token. `docker compose up` for the control plane. |

That is the whole MVP. Four things, two screens.

## 3. What you do yourself in the terminal, for now

- `git clone`, worktrees, branches, PRs with `gh`.
- `claude`, `codex`, `kimi` login and use. Multiple accounts by setting
  `CLAUDE_CONFIG_DIR` yourself.
- Secrets: they live on the machine already.

## 4. Deliberately out

Everything in notes 02 to 06 that is not in the table above: GitHub
App, per-session tokens, worktree automation, Create PR, account
objects, screen-manifest states, usage meters, VMs, egress proxy, Tailscale
mode, signed updates, multi-tenant.

## 5. Order

| Step | You can now | Size |
|------|-------------|------|
| 1 | Runner on the Mac, one page, tmux-backed terminal, close the tab, reopen, still there | 1 week |
| 2 | Control plane with login, targets, sessions list, tickets, docker compose | 1 week |
| 3 | Phone layout, reconnect ladder, tail replay polish, login URL button, second target on Linux | 1 week |

Three weeks. Step 1 is still the gate: if it does not feel like Orca
over SSH, fix that first.

## 6. Done means

- The scene runs on a real Mac Studio and a real Linux server from a
  phone.
- Closing the browser, losing wifi, and restarting the runner do not kill
  a session.
- The control plane stores no credential except its own login and the
  target tokens.

## 7. The next slice, in order

1. Board states from screen manifests (working / blocked / done), because
   it is the first thing you miss with ten sessions open.
2. Project + worktree + branch per session, and Create PR.
3. GitHub App with per-session tokens.
4. Accounts as objects with per-session selection.
5. Mode B VMs, which brings the egress proxy and the rest of the security
   review.
