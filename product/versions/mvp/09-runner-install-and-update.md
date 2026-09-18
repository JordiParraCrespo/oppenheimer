# 09 — Runner install and update

Getting the runner onto a host you own, and keeping it current
afterwards. The runner itself is [02](02-runner.md); this document is
everything around it: what the Add host screen hands you, what runs on
your machine, and how a new version arrives without anyone typing a
command a second time.

Two properties hold everywhere below. **Nothing runs as root**, because
a direct-mode host is the user's own machine and the runner has no
business above their account (F10). **The control plane can offer a
version, never push code**: the only thing a runner will ever execute is
an artifact whose digest appears in a manifest signed by an offline key
the control plane does not hold (F26).

## Decided

### 1. Three ways in, one binary

The Add host screen offers, in this order:

- **One command.** Copy, paste into a terminal on the host, done.

  ```sh
  curl -fsSL https://get.oppenheimer.dev/install.sh | sh -s -- \
    --token <registration token> --url https://app.oppenheimer.dev
  ```

  The screen shows the installer's own SHA-256 next to it, so the
  careful path — download, read, run — is a click away and not a
  different set of instructions.
- **An agent prompt.** The same steps spelled out for a Claude Code or
  Codex already running on that machine, instead of hidden inside
  `curl | sh`: what the runner is, download and checksum, place in
  `~/.local/bin`, register with the token, install the service, confirm
  online, report the preflight. It carries an explicit do-not list: not
  as root, no ports, do not copy the token elsewhere, stop if the
  checksum differs. The only secret in it is the registration token,
  which can do exactly one thing — add one host to your workspace — and
  expires in an hour. The prompt is versioned and served by the control
  plane, so a runner release can change steps and checksums without a
  web deploy.
- **The manual path**, for an air-gapped or suspicious host: the
  tarball, its `SHA256SUMS` and the detached signature from the release
  page, verified by hand, then `runner register` and `runner install`.

All three end in the same place: a binary under `~/.oppenheimer/bin`, a
`config.json`, a user service, and a host that shows online. The
installer is idempotent — re-running it repairs a half-finished install
rather than producing a second one.

### 2. What the installer does, in order

1. **Refuse to be root.** If `id -u` is 0 it stops and says to run it as
   the user who will own the sessions.
2. **Detect** os and arch (darwin and linux × arm64 and amd64) and stop
   on anything else with the list of what is supported.
3. **Fetch the signed release manifest** for the host's channel, verify
   its signature against the public key baked into the script, and take
   the version, URL and digest for this target from it.
4. **Download and verify**: SHA-256 against the manifest, then the
   artifact's detached signature. A mismatch aborts and deletes the
   download — there is no "continue anyway" flag.
5. **Place** it at `~/.oppenheimer/bin/runner-<version>`, point the
   `current` symlink at it, and drop a shim at
   `~/.local/bin/oppenheimer-runner`. On macOS strip the quarantine
   attribute (`xattr -d com.apple.quarantine`) until the binary is
   signed; a plain binary and a launchd user agent need no notarization,
   only a `.app` would.
6. **Preflight** `git`, `tmux`, `claude`, free disk. `tmux` is required,
   so when it is missing the installer offers to install it with `brew`
   or `apt` and says exactly which command it will run, with sudo, and
   what happens if you decline (sessions will not start until you
   install it yourself). `claude` missing is a hint, not a failure
   (02 §10).
7. **Register** (§3) and **install the service** (§4).
8. **Confirm**: wait for the link to come up, then print the host id,
   the version, and the preflight table. The same table is what the
   console shows on the host's row.

### 3. Pairing

The GitHub Actions runner pattern, which solves exactly this problem:
get a machine behind a NAT talking to a control plane without ever
putting the user's credentials on it.

- Settings mints a **one-hour, single-use registration token**, shown
  inside the install command. It is revocable, and the console shows the
  source IP that redeemed it (F5).
- `runner register` generates an **ed25519 keypair**, writes the private
  key 0600 (F8), and sends the public key with the host facts and a name.
- The control plane burns the token, stores the public key, and answers
  with the **host id** and **its own key fingerprint**, which the runner
  pins in `config.json` and checks on every dial thereafter (F6).
- Every later boot signs a short-lived JWT with the host key. The
  registration token is never stored and never reusable.
- Rotation is `runner register --rotate-key` against an authenticated
  link: new keypair, new public key, old key retired after the next
  successful dial.
- A pairing-code flow — install first, type a code in the browser — is
  not needed while pasting a command works.

### 4. The service, and removing it

- **macOS**: a launchd **user agent**,
  `~/Library/LaunchAgents/dev.oppenheimer.runner.plist`, `RunAtLoad` and
  `KeepAlive`, `ProgramArguments` pointing at
  `~/.oppenheimer/bin/current run`, stdout and stderr to
  `~/.oppenheimer/log/`.
- **Linux**: a systemd **user unit**,
  `~/.config/systemd/user/oppenheimer-runner.service`, `Restart=always`,
  plus `loginctl enable-linger $USER` so it survives logout and comes up
  at boot. The installer runs the linger command and says so; without it
  the runner would only exist while the user is logged in, which is not
  what "my Hetzner box" means.
- Both point at the `current` symlink, never at a versioned path, which
  is what makes an update a symlink swap plus a restart (§5).
- **`runner uninstall`** stops and removes the unit, revokes the host
  key at the control plane, and deletes `~/.oppenheimer`. It refuses
  while sessions are live unless `--force`, and it **never touches
  `~/oppenheimer-ai`** — that directory is the user's code and their
  worktrees. It prints what it left behind.

### 5. Updates

- **Artifacts.** A tag builds `runner_<version>_<os>_<arch>.tar.gz` for
  the four targets, `CGO_ENABLED=0 -trimpath`, version stamped through
  ldflags. The release carries `SHA256SUMS` and a detached signature
  made with a **minisign key held offline**, never a CI secret. The
  public key is **compiled into the runner** so the update path does not
  depend on the network to know what to trust; the binary carries the
  current key and the next one, so a key roll does not strand old hosts.
- **The manifest.** The control plane serves
  `GET /v1/runner/releases?channel=…&os=…&arch=…` with the version, the
  artifact URL, its digest, the signature, and `min_supported`. The
  control plane may choose *which* version a host is offered — a
  percentage rollout, an allowlist, a stop — but it cannot invent one:
  the runner installs only what the offline key signed, from the release
  host pinned in `config.json`. A compromised control plane can withhold
  updates, not deliver code.
- **Channels and pinning.** `stable` by default, `beta` opt-in per host
  in Settings, and `runner update --pin <version>` freezes a host
  entirely; the console shows pinned hosts as pinned, because a host
  that silently stopped updating is the failure nobody notices.
- **When it runs.** On boot, every six hours, and immediately when a
  heartbeat reply carries `update_available`. The runner then waits for
  a **safe window** — no session in `working`, no client attached —
  capped at 24 hours, after which it updates anyway. An update flagged
  urgent, or an `update_required` hint (§6), skips the window and
  applies within fifteen minutes.
- **Why waiting is cheap and updating is cheaper.** Sessions live in the
  tmux server, which is a separate process tree (02 §6). Replacing the
  runner drops the PTY attachments and the link, and nothing else. The
  browser sees a reconnect it already knows how to handle; the new
  process adopts the tmux sessions, rehydrates the ring buffers from
  `capture-pane`, and resumes the streams. No worktree is touched, no
  agent is interrupted, no scrollback is lost.
- **The swap**, atomic at every step:

  1. Download to `~/.oppenheimer/bin/.staging/` — same filesystem, so
     the rename is atomic.
  2. Verify digest and signature. Any mismatch aborts and the staging
     directory is emptied.
  3. `chmod 0755`, strip quarantine on macOS, then run
     `runner-<version> selfcheck`: the **new binary** proves it can
     parse the config and speak a protocol range the control plane
     accepts. A wrong-arch, truncated or incompatible binary dies here,
     while the old one is still the service.
  4. `rename()` into place, then repoint `current` by creating a temp
     symlink and renaming it over the old one.
  5. Record `{from, to, at, attempts}` in `~/.oppenheimer/state/update.json`.
  6. Restart through the service manager — `launchctl kickstart -k` or
     `systemctl --user restart` — and if that fails, exit so `KeepAlive`
     or `Restart=always` brings the new binary up.
- **The health gate and rollback.** The new process must reach online —
  link authenticated, sessions adopted — within 60 s and stay up for
  five minutes; then it marks the update record good. A process that
  boots and finds a *pending* record with two attempts already spent
  repoints `current` at the previous version, restarts, and reports
  `update_failed` with the last lines of its log. The previous two
  versions stay on disk for exactly this; older ones are pruned.
- **Manual control.** `runner update [--check] [--version x.y.z]
  [--pin|--unpin]` from the host, and an Update now button in the
  console that sends `host.update` over the link. Both go through the
  same verification; neither is a way to run something unsigned. A
  downgrade is allowed to a retained version at or above
  `min_supported`, with a warning.
- **A managed install defers.** If the running binary is not under
  `~/.oppenheimer/bin` — a Homebrew tap or a distro package later — the
  updater does not swap it. It reports the available version and lets
  the package manager own the file.

### 6. Compatibility

- The link's hello carries the protocol range the runner speaks. The
  control plane refuses anything below `min_supported` with an
  **update-required hint** rather than a bare error — the structured
  hints 01 already reserves, taken from note 12;
  the console shows "Host needs an update" with the one command, and an
  auto-updating host fixes itself without the user seeing the screen.
- The control plane supports runners two minor versions back. Wire
  changes are additive within a major version, so a new control plane
  and an old runner is a supported pair for weeks, not hours.
- Version, channel, pin and last update outcome are on the host's row in
  Settings. A fleet of one is still a fleet; the screen answers "is this
  host current" without an SSH session.

### 7. What this deliberately prevents

| Attack | Why it fails |
|---|---|
| Control plane compromised, pushes a malicious runner | It cannot sign the manifest; the offline key is not in CI, let alone in the control plane |
| Release host compromised, serves a different binary | Digest and signature are checked after download, from a key compiled into the running binary |
| Registration token stolen | One hour, one use, one host added to that workspace; the source IP is shown and it can be revoked |
| Host key stolen | It only authenticates a dial; rotation is a subcommand, revocation is a click, and the console shows the last dial |
| Someone tricks the user into `sudo`-ing the installer | It refuses to run as root before it does anything else |
| A bad release bricks a fleet | Percentage rollout, selfcheck before the swap, a health gate and automatic rollback after it |

## Open questions

1. Signing tool: minisign, or cosign with a key in a hardware token.
   Minisign is the smaller dependency and easy to verify in a shell
   script; cosign buys transparency-log verification we do not need yet.
2. Do we also publish a Homebrew tap and a `.deb` at launch, or wait for
   install friction to prove it? Waiting, on the assumption that the
   install command is the onboarding path and a package is the
   second-visit path.
3. Windows, through WSL2 or not at all in this slice. Not at all for
   now; the runner is Linux and macOS.
4. Whether the installer should offer to install `claude` too, rather
   than hint. Hint for now — the agent's login and version are the
   user's, not ours to manage (00 §"Agent login is the host's own").
5. Update telemetry: is "version, channel, last outcome" per host enough
   to run a rollout, or does the control plane need per-attempt records
   to spot a version that fails the health gate on one distro?
