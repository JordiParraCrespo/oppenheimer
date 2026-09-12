# 02 — Runner

## Decided

- One Go binary, a static build for Linux and macOS, installed by one
  command as the user's own account (launchd on macOS, a systemd user
  unit on Linux). In the MVP it shares only the GitHub App client with
  the existing runner controller; the libvirt pieces come with the VM
  slice (note 08).
- Sessions are tmux-backed PTYs. Ring buffer per session, tail replay on
  attach, reconnect ladder with an epoch counter.
- **tmux topology.** One tmux server per host on a dedicated socket
  (`tmux -L oppenheimer`) so it never collides with the user's own
  tmux. One tmux session per oppenheimer session, named by the session
  id, created with `new-session -d -s <id> -c <worktree>` and window 0
  running the agent. Each browser tab is a tmux window in that session
  (`new-window`), so every tab has its own scrollback and resize, and a
  phone-sized tab does not shrink the laptop's. Closing the session is
  `kill-session`. Working directory, environment, and the credential
  helper socket are set once at creation and inherited by every window.
  The runner attaches by spawning a PTY running
  `tmux attach -t <id>:<window>` per browser connection, so several
  devices can view one window; tmux sizes the window to the smallest
  attached client, accepted for the MVP. The runner passes its own
  tmux config: status bar off, mouse on, 50k scrollback, no prefix key.
  State dots come from `capture-pane` on window 0 every few seconds,
  which is also how the login URL is detected. The tmux server outlives
  the runner, so a runner restart or upgrade loses nothing: on boot the
  runner lists sessions, re-adopts those the control plane knows, and
  kills orphans after a grace period. A host reboot shows every session
  as stopped with a Restart button that recreates window 0 in the same
  worktree.
- **Pairing** is the GitHub Actions runner pattern. Settings shows one
  install command carrying a one-hour, single-use registration token.
  The command downloads the binary for that OS and arch, verifies its
  SHA-256, generates a keypair, registers the public key with the token,
  receives a host id, installs the user service, and dials out. The
  token is burned on first use; every later boot signs a short JWT with
  the host's private key. The runner reports whether `git`, `tmux`, and
  `claude` were found. On macOS the installer removes the quarantine
  flag until the binary is signed. A pairing-code flow (install first,
  type a code in the browser) is not needed while pasting works.
- **Agent install prompt.** The Add host screen also offers a prompt
  to paste into Claude Code or Codex already running on that machine.
  It spells the same steps out instead of hiding them in `curl | sh`:
  what the runner is, download and checksum, place in `~/.local/bin`,
  register with the token, install the service, confirm online, report
  the preflight (git, tmux, claude, disk, quarantine flag). It carries
  an explicit do-not list: not as root, no ports, do not copy the token
  elsewhere, stop if the checksum differs. The only secret in it is the
  registration token, which can do exactly one thing, add one host to
  your workspace, and expires in an hour. The prompt is versioned and
  served by the control plane so a runner release can change steps and
  checksums without a web deploy.
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

1. ~~tmux topology~~: decided above, one server per host on its own
   socket, one tmux session per oppenheimer session, windows as tabs.
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
   installs it? Check and hint. `tmux` is required: the installer
   installs it via apt or brew when missing.
6. Package map against the real runner repository: pending its name.
