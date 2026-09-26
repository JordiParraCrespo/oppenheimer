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
  curl --proto '=https' --tlsv1.2 -fsSL https://get.oppenheimer.dev/install.sh |
    OPPENHEIMER_REGISTRATION_TOKEN=<registration token> sh -s -- \
    --url https://app.oppenheimer.dev
  ```

  The token rides in the installer's **environment**, not as `--token`:
  an argument sits in the process list, readable by every account on the
  machine for as long as the install runs, and the installer hands it to
  `runner register` the same way. `--proto '=https' --tlsv1.2` is rustup's
  pin: no redirect can downgrade the download to plain HTTP.

  The screen shows the installer's own SHA-256 under the command
  (`RUNNER_INSTALL_SHA256`, printed by `scripts/runner/release.sh`), so
  the careful path — download, read, check, run — is a click away and not
  a different set of instructions.
- **An agent prompt.** The same steps spelled out for a Claude Code or
  Codex, instead of hidden inside `curl | sh`. Its first job is to
  establish that the agent is on the machine the person means — the agent
  may be on a laptop while the host is a VPS, or in a container that will
  be gone in an hour — because the token is single-use and spending it on
  the wrong box leaves a host nobody wanted and no token. So it opens with
  a step 0 that runs nothing: name the machine and ask, refuse a
  temporary one, ask where session code should live, and check `git` and
  `tmux`, asking before installing either. Then the command (or an SSH
  form that sends the token on stdin), then `runner status` read line by
  line — never by its exit code, which is 0 for an unpaired host — and a
  branch per error code the runner reports. It carries an explicit
  do-not list: not as root, no ports, never write or repeat the token.
  The only secret in it is the registration token, which can do exactly
  one thing — add one host to your account — and expires in an hour. The
  prompt is templated by the control plane
  (`apps/api/src/hosts/infrastructure/runner-release.config.ts`), so a
  runner release can change steps without a web deploy.
- **The manual path**, for an air-gapped or suspicious host: the
  tarball, its `SHA256SUMS` and the detached signature from the release
  page, verified by hand, then `runner register` and `runner install`.

All three end in the same place: a binary under `~/.oppenheimer/bin`, a
`config.json`, a user service, and a host that shows online. The
installer is idempotent — re-running the same command repairs a
half-finished install rather than producing a second one: it registers
with `--keep-existing`, so a host already paired to this control plane
keeps its pairing and the token is not spent again.

### 2. What the installer does, in order

The whole script is one `main` called on its last line, so a download cut
short defines functions and runs none of them — the partial-execution
failure every `curl | sh` has unless it is written this way.

1. **Refuse to be root.** If `id -u` is 0 it stops and says to run it as
   the user who will own the sessions.
2. **Refuse plain HTTP.** The control plane URL, the release base and
   every artifact URL must be `https://`; plain HTTP is allowed only to
   `localhost` for development. Artifacts must come from the release host
   the command named, the same rule the updater applies (§5).
3. **Detect** os and arch (darwin and linux × arm64 and amd64) and stop
   on anything else with the list of what is supported.
4. **Ask everything up front**, before anything is downloaded, so the
   rest runs unattended and a "no" costs nothing. Questions go to
   `/dev/tty` — under `curl | sh` stdin is the script itself, so a
   question read from stdin can never be answered — and are only asked
   when a terminal can be opened:
   - **where session code lives** (`--workspaces`, default
     `~/oppenheimer-ai/workspaces`), refused inside `~/.oppenheimer` and
     warned about inside a synced folder;
   - **`git` and `tmux`**, the two tools sessions cannot start without.
     When one is missing, the installer shows the exact command it would
     run — `brew install …` or `sudo apt-get …` — and asks `[y/N]`: only a
     typed yes installs, and Enter means no. With no terminal (an agent,
     CI) it installs nothing. Either way, a tool that is still missing
     stops the install **before the token is spent**, so the same command
     works once the tool is there. `claude` missing is a hint, not a
     failure (02 §10).
5. **Fetch the signed release manifest** for the host's channel and, where
   OpenSSL 3 is available, **check its Ed25519 signature** against the
   release keys `scripts/runner/release.sh` stamps into the copy of the
   script it publishes — the same keys the binary has compiled in. macOS
   ships LibreSSL, which cannot, and there the script says so and relies
   on HTTPS for the first download; every later update is verified by the
   binary itself. A signature that does not verify aborts.
6. **Download and verify**: SHA-256 against the manifest. A mismatch
   aborts and deletes the download — there is no "continue anyway" flag.
   The manifest's artifact entry is read whatever order its fields come
   in.
7. **Place** it at `~/.oppenheimer/bin/runner-<version>`, point the
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
8. **Register** (§3) with `--keep-existing`, the token in the runner's
   environment, and **install the service** (§4).
9. **Confirm**: print `runner status` — the host id, the key fingerprint,
   the version, the preflight table, and where sessions will live. The
   same table is what the console shows on the host's row.

**From cloud-init (v0.2).** A cloud machine (03 §Cloud hosts) runs
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

- Add host — the dialog, or onboarding's host step — mints a **one-hour,
  single-use registration token**, shown inside the install command.
  The command carries it as an environment assignment
  (`OPPENHEIMER_REGISTRATION_TOKEN=… sh`), so it is an argument of nothing
  the installer or the runner runs; it is still on the line the person
  pastes, and in that shell's history until it expires. It is revocable, and the console shows the
  source IP that redeemed it (F5).
- `runner register` generates an **ed25519 keypair**, writes the private
  key 0600 (F8), and sends the public key with the host facts and a name.
  It takes the token from `--token-file` (or `-` for stdin) or
  `OPPENHEIMER_REGISTRATION_TOKEN`, so it never has to be an argument;
  `--token` still works.
- It **refuses a machine that looks temporary** — `/.dockerenv`,
  `/run/.containerenv`, a container cgroup, or `CI`, `GITHUB_ACTIONS`,
  `CODESPACES`, `REMOTE_CONTAINERS`, `DEVCONTAINER`, `GITPOD_WORKSPACE_ID`
  or `KUBERNETES_SERVICE_HOST` set — with `HOST_006`, before the token is
  sent. `--allow-container` is the deliberate answer for a container that
  is meant to last; the e2e fleet passes it.
- The control plane burns the token, stores the public key, and answers
  with the **host id** and **its own key fingerprint**, which the runner
  pins in `config.json` and checks on every dial thereafter (F6).
- Every later boot signs a short-lived JWT with the host key. The
  registration token is never stored and never reusable.
- **Key rotation waits for the link to carry it** (decided 2026-09-19,
  MVP decision log): the register route redeems registration tokens and
  cannot rotate a key. Until then the answer to a stolen host key is to
  unpair the host and pair the machine again. The verifier already takes a
  list of keys, so the retired key joins it when rotation lands.
- **A host that is unpaired stops dialling.** The link refuses an
  unpaired host at the handshake and closes a live one (01), and the
  runner treats both as terminal: it records the revocation in
  `config.json`, stops redialling, and says so in `runner status` —
  rather than walking its reconnect ladder against a control plane that
  will never take it back. Pairing it again needs no `--force`.
- **The owner is told.** Every registration queues a security email to
  the host's owner — the machine, and the first sixteen characters of its
  key fingerprint, which `runner status` prints in full — the way GitHub
  mails you when an SSH key is added. It is the cheapest way to notice a
  stolen token.
- **One person holds at most five unspent tokens** (`HOSTS_006`), each a
  live way to add a machine for its hour. The count and the insert are one
  write, so two tabs minting at once cannot both find room. Add host's
  "New token" mints a replacement that retires the token on screen in the
  same write, so a command pasted into the wrong window stops working at
  once, and a refused mint leaves the old one as it was.
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
  key at the control plane, and erases the identity (`config.json` and
  `host.key`). It **refuses while any of the runner's tmux sessions is
  running** unless `--force`, which ends them: the unit deliberately
  leaves tmux up when the runner stops, so without the check an agent
  would keep working after the uninstall with no control plane and no
  console. `--force` ends the sessions and keeps their checkouts; a
  session it cannot end stops the uninstall before the identity is
  erased, so the host stays paired and a second run can finish. It says
  when the control plane could not be reached — the host is then still
  listed and its key still trusted until it is unpaired there
  (`DELETE /v1/hosts/{id}`; the console has no unpair control yet) — and
  it **never touches the workspaces directory**, which is the user's
  code. Binaries and logs under `~/.oppenheimer` are left for the user to
  delete, and it prints both paths.
- **Where sessions live** is chosen at install (`--workspaces`) and saved
  in `config.json`, so the service, `runner status` and `runner sessions`
  agree on it without an environment variable; `RUNNER_WORKSPACES` still
  wins, for development. `runner workspaces --set <dir>` moves where new
  sessions go, refused while any session's worktree is still on disk
  under the old directory, and moves nothing.

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
  at install (`--channel beta`) and, with the settings drawer, from the
  console; and `runner update --pin <version>` freezes a host
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
- Version, channel, pin and last update outcome will be on the host's row
  in the settings drawer (05, a later slice); until then `runner status`
  on the host shows them. A fleet of one is still a fleet; the screen answers "is this
  host current" without an SSH session.

### 7. What this deliberately prevents

| Attack | Why it fails |
|---|---|
| Control plane compromised, pushes a malicious runner | It cannot sign the manifest; the offline key is not in CI, let alone in the control plane |
| Release host compromised, serves a different binary **to an installed runner** | Digest and signature are checked after download, against a key compiled into the running binary |
| Release host compromised **during a first install** | Not fully prevented. `install.sh` is fetched over HTTPS and trusted on first use. The manifest signature is now checked by the script where OpenSSL 3 exists, but against keys the script itself carries, so a host that serves both the script and the manifest can replace both. The anchor is the installer digest the control plane shows on the Add host screen, which lives on a different host; then the token's single hour, and keeping the script host, the artifact host and the control plane separate (03). F26 begins at the first self-update — see F26a in 07 |
| A download of `install.sh` cut short | Everything runs from `main` on the last line, so a partial script defines functions and runs none |
| A redirect or proxy downgrades a download to HTTP | Every URL must be `https://` (loopback excepted), `curl --proto '=https' --tlsv1.2` refuses a downgrade, and artifacts must come from the release host |
| Registration token stolen | One hour, one use, one host added to that account, never on a command line; the source IP is shown and it can be revoked. The owner is emailed the moment a machine pairs, one person holds at most five unspent tokens, and "New token" revokes the one it replaces |
| Token spent on a container or CI job that disappears | `runner register` refuses a machine that looks temporary (`HOST_006`) before sending the token; the agent prompt asks first |
| Host key stolen | It only authenticates a dial, and an unpaired host cannot hold a link or be granted credentials. Rotation waits for the link (§3); until then the answer is to unpair and pair again |
| A host the user unpaired keeps dialling, or keeps its link | Refused at the handshake and closed within a heartbeat — at once on the instance holding the link — and the runner stops dialling for good |
| Uninstall leaves agents running unattended | `runner uninstall` refuses while the runner's sessions run, unless `--force`, which ends them |
| An old, validly signed manifest is served again to freeze a host on a vulnerable version | **Accepted for now.** The manifest carries no expiry, so a compromised release host can withhold updates. The control plane's `update_required` and `update_available` hints are a second channel that does not go through the release host; a signed expiry (TUF's freeze defence) is the thing to add if that proves insufficient |
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
