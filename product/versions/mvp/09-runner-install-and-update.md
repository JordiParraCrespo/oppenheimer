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
  which can do exactly one thing — add one host to your account, usable
  from any of your workspaces — and expires in an hour. The prompt is
  versioned and served by the control plane, so a runner release can
  change steps and checksums without a web deploy.
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
3. **Fetch the signed release manifest** for the host's channel and take
   the version, URL and digest for this target from it. The script checks
   the **digest**, because `shasum` is on every macOS and `sha256sum` on
   every Debian; the **signature** is checked by the binary, which has the
   public key compiled in — a signature tool is not something an installer
   can assume, and shipping one would be a second thing to trust.
4. **Download and verify**: SHA-256 against the manifest, then the
   artifact's detached signature. A mismatch aborts and deletes the
   download — there is no "continue anyway" flag.
5. **Place** it at `~/.oppenheimer/bin/runner-<version>`, point the
   `current` symlink at it, and drop a shim at
   `~/.local/bin/oppenheimer-runner`.

   One artifact, three paths, and they are not three names: the command
   a person types is **`oppenheimer-runner`** (the shim on `PATH`); the
   file inside the release archive and the layout is `runner`, because
   the layout is already `~/.oppenheimer/bin`; the service unit executes
   `current`, never a version. These notes write `runner <subcommand>`
   for brevity and mean the shim. On macOS strip the quarantine
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

**From cloud-init (v0.2).** A cloud machine (03 §Cloud machines) runs
this same installer, with two things cloud-init has to get right.
cloud-init runs as root and step 1 refuses root; and steps 7 and 8 need
a systemd user session that a plain `runuser` has not got — `runner
install` calls `systemctl --user`, which fails with "Failed to connect
to bus" over su-style execution
(`apps/runner/internal/service/adapters/systemd/manager.go`). So the
cloud-config does, in order: create the `agent` user;
`loginctl enable-linger agent`, which starts `user@<uid>.service` and
its bus and is the linger §4 needs anyway; then the installer as that
user with its runtime environment set —
`runuser -u agent -- env XDG_RUNTIME_DIR=/run/user/<uid>
DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/<uid>/bus sh -c 'curl … |
sh -s -- --token … --url …'`. The token is spent at step 7 either way,
so an install that fails at step 8 has created a host that never comes
online; the control plane's sweeper destroys such a machine after the
boot budget. On a resumed machine user-data does not run again — the
service unit is what brings the runner back.

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
  the four targets (`darwin/arm64`, `darwin/amd64`, `linux/amd64`,
  `linux/arm64`), `CGO_ENABLED=0 -trimpath`, version stamped through
  ldflags. The release carries `SHA256SUMS` and a detached signature
  made with an **Ed25519 key held offline**, never a CI secret. The
  public key is **compiled into the runner** so the update path does not
  depend on the network to know what to trust; the binary carries the
  current key and the next one, so a key roll does not strand old hosts.
  Signing is `openssl` and nothing else — `openssl genpkey -algorithm
  ed25519` once, `openssl pkeyutl -sign -rawin` per release — so the key
  can live on a machine with no toolchain on it
  (`scripts/runner/sign-release.sh`). A build made without a key refuses
  every update rather than trusting one: the alternative to "no key" is
  "no updates", never "unsigned updates".
- **The manifest.** The release host serves `<base>/<channel>.json` and
  its detached signature; the base is pinned in `config.json` at
  registration. The runner installs only what the offline key signed,
  and only an artifact whose URL is on that host. Which version a host
  is offered — a percentage rollout, an allowlist, a stop — and the
  route that serves it are the control plane's, and they are specified
  in [03](03-control-plane.md) §"Runner-facing surfaces". A compromised
  control plane can withhold updates; it cannot deliver code.
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
  3. `chmod 0700`, strip quarantine on macOS, then run
     `runner-<version> selfcheck`.
  4. `rename()` into place, then repoint `current` by creating a temp
     symlink and renaming it over the old one.
  5. Record the update, then restart through the service manager —
     `launchctl kickstart -k` or `systemctl --user restart` — and if
     that fails, exit so `KeepAlive` or `Restart=always` brings the new
     binary up.

- **What `selfcheck` is.** The staged binary proves it runs *on this
  machine*: it resolves its layout, parses the identity, and reports its
  version, target and platform. It does **not** dial the control plane,
  and it must not: a second process taking the flock, the socket or the
  host JWT while the daemon is live is a worse failure than the one it
  would catch. A protocol mismatch is caught at hello by the runner that
  actually dials, and the escape hatch for that is the release fetch
  being plain HTTPS (01).

- **The state machine.** Four states, one transition table, because a
  paragraph is where special cases come from:

  | State | Means | Leaves it when |
  |---|---|---|
  | `staging` | downloading and verifying; nothing on disk is live | verification fails (→ gone, staging emptied) or the binary is promoted (→ `pending`) |
  | `pending(n)` | `current` points at the new version; `n` boots have started and none has reached the gate | the new process stays up for the health gate (→ `healthy`), or `n` reaches 2 (→ `rolled_back`) |
  | `healthy` | the update is done | never; the record is closed and the old binaries are pruned to the running one and its predecessor |
  | `rolled_back` | `current` points at the previous version again | never; the outcome is reported and the release is not retried until a newer one appears |

  `n` increments **once per boot of the new binary**, in the running
  process, before anything else — not at download, not at selfcheck, not
  at restart. So a binary that crashes on start gets exactly two
  attempts however fast `KeepAlive` respawns it.

- **What rollback may touch.** `current`, and the update record. Not
  `config.json`, not `host.key`, not the session map: a new version that
  came up far enough to rewrite the identity and then died is a bug to
  report, not state to revert, and reverting it would risk losing a key
  rotation the control plane already knows about.

- **One clock.** An urgent or required update applies within
  `UrgentDelay` (15 minutes) — there is no "immediately". Everything
  else waits for a quiet moment, capped at 24 hours. 02 §12 says the
  same thing in one line and points here.

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
| Release host compromised, serves a different binary **to an installed runner** | Digest and signature are checked after download, against a key compiled into the running binary |
| Release host compromised **during a first install** | Not prevented. `install.sh` is fetched over HTTPS and trusted on first use; a host that serves both the script and the manifest can replace both. The mitigations are the digest shown on the Add host screen, the token's single hour, and keeping the script host, the artifact host and the control plane separate (03). F26 begins at the first self-update — see F26a in 07 |
| Registration token stolen | One hour, one use, one host added to that account; the source IP is shown and it can be revoked |
| Host key stolen | It only authenticates a dial; rotation is a subcommand, revocation is a click, and the console shows the last dial |
| Someone tricks the user into `sudo`-ing the installer | It refuses to run as root before it does anything else |
| A bad release bricks a fleet | Percentage rollout, selfcheck before the swap, a health gate and automatic rollback after it |

## Open questions

1. ~~Signing tool~~: decided — plain Ed25519 with `openssl` on both ends,
   verified in the runner with `crypto/ed25519`. It adds no dependency to
   the binary, to the installer or to the machine holding the key.
   Cosign's transparency log is the thing to revisit if we ever want
   third parties to audit our releases.
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
