# 02 — Runner

## Decided

- One Go binary, a static build for Linux and macOS, installed by one
  command as the user's own account (launchd on macOS, a systemd user
  unit on Linux). In the MVP it shares only the GitHub App client with
  the existing runner controller; the libvirt pieces come with the VM
  slice (note 08).
- Sessions are tmux-backed PTYs. Ring buffer per session, tail replay on
  attach, reconnect ladder with an epoch counter.
- Screen manifests classify each pane as working, blocked, done, idle,
  or unknown (note 03 §1). Codex manifest first.
- Workspaces: on session create, ensure
  `~/oppenheimer-ai/workspaces/<repo>/main` exists and is fetched, then
  `git worktree add worktrees/<slug>` from it at the chosen branch. On
  close, push the branch and `git worktree remove`.
- Git credentials: a `credential-helper` subcommand that git in the
  session's shell calls; it asks the runner over a Unix socket for the
  current one-hour token for that session's repository. Nothing on
  disk. The runner refreshes the token from the control plane before
  expiry.
- Agent launch: `claude` from the host's own installation and login,
  in the worktree, inside tmux. The login URL it prints is detected and
  sent to the browser as a button.
- Deferred to the VM slice: guest agent, vsock, libvirt lifecycle,
  sleep tiers, account volumes, capacity gate.

## Open questions

1. tmux topology: one tmux server per host with one tmux session per
   worktree (simple, one socket), or one server per worktree?
2. Screen manifests: regexes over the last N lines, or a small state
   machine fed by Codex's own hooks where available? Codex supports
   lifecycle hooks with trusted hashes (note 06), which is more reliable
   than screen scraping.
3. Idle detection input: terminal I/O silence, agent state from the
   manifest, or both? A long Codex run with no keystrokes is not idle.
4. macOS install: launchd agent under the user, code signing or
   notarization needed to avoid Gatekeeper friction for a curl-installed
   binary? A plain binary run from a shell is fine; a launchd agent is
   fine; only a `.app` needs notarization.
5. Node and Claude Code presence on the host: the runner checks for
   `claude` on PATH and shows an install hint in the UI if missing, or
   installs it? Check and hint.
6. Package map against the real runner repository: pending its name.
