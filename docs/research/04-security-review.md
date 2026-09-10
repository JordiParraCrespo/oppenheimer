# 04 — Security review of the design so far

Scope: everything in notes 00 to 03. Method: list the assets, list who can
attack, walk each trust boundary, and rate what is left. Findings are
numbered so they can be tracked into ADRs and tests.

## 1. Assets, in order of how bad losing them is

1. **Vendor subscription credentials** on targets (`~/.claude`, `~/.codex`).
   Loss means account compromise and a policy violation.
2. **GitHub access**: the App's user authorization and the per-session
   tokens. Loss means every repo the user can see.
3. **Project secrets** in the vault (`.env`, API keys, deploy tokens).
4. **The targets themselves**: a direct-mode machine is the user's real
   computer with a docker socket and everything.
5. **Source code and terminal scrollback** in flight and at rest.
6. **The control plane database**: who owns what, session logs.

## 2. Who is attacking

- **A: the agent itself.** Prompt injection through a README, an issue, a
  dependency's postinstall, a web page it fetched. It runs `env`, reads
  `~/.ssh`, `curl`s a token somewhere, or pushes to the wrong branch. This
  is the most likely attacker and the one Claude Code on the web is built
  around.
- **B: code the agent runs.** Malicious npm package, test suite, docker
  image. Same as A but does not need to fool a model.
- **C: another user of the platform.** Only matters when it is
  multi-tenant. Wants another user's targets, secrets, or sessions.
- **D: the internet.** Scans for the control plane, the relay, exposed
  runner ports, or leaked registration tokens.
- **E: a compromised control plane.** Someone with the database or the
  server. Matters for what we can promise even then.

## 3. Boundary by boundary

### Browser ⇄ control plane

Design: HTTPS, session cookies, GitHub OAuth login, SSE and WebSocket for
terminals.

- **F1 (high) The terminal WebSocket must be authorized per session, not
  per connection.** A browser socket presents a short-lived, per-session
  ticket minted by the API after checking ownership. The relay never
  trusts a session id alone. Tickets expire in seconds and are single-use.
- **F2 (medium) Origin and CSRF.** WebSocket upgrades check `Origin`
  against the configured web host. All mutating HTTP is same-site cookie
  plus a header token.
- **F3 (medium) Terminal output is untrusted HTML-adjacent content.**
  xterm.js renders escape sequences safely, but the link detector and
  the "login URL" badge must only linkify `https://` URLs from an
  allowlist of vendor login hosts. An agent can print any string; we do
  not want a phishing link dressed up as "open in new tab".
- **F4 (low) Rate-limit session creation and target registration** per
  user; both create real resources on real machines.

### Control plane ⇄ runner

Design (note 03): registration token, RSA keypair, clientId, signed JWT
for a session token, outbound WebSocket, job messages encrypted to the
runner key.

- **F5 (high) Registration token exposure.** It is embedded in a curl
  command a user pastes. One hour lifetime, single use, bound to the user
  and org, revocable from the UI. Log the source IP and show it in the
  target's page so a stolen token is visible.
- **F6 (high) Pin the control plane in the runner.** The install command
  carries the control plane URL and its public key fingerprint. The
  runner refuses any other host. This defeats a DNS or proxy trick that
  points a runner at a fake control plane which then hands it jobs.
- **F7 (medium) Job messages carry secrets.** Encrypt each job payload to
  the runner's public key at the API layer, so the relay, logs, and the
  database never hold a plaintext secret bundle. This is exactly the
  Actions design, and it is what makes attacker E only "bad" rather than
  "total".
- **F8 (medium) Runner private key at rest.** File mode 0600 under the
  runner's own user, or the OS keychain on macOS. Rotation supported from
  the UI. A target that changes key must re-register.
- **F9 (low) Heartbeat integrity.** Capabilities reported by the runner
  (docker available, KVM available, isolation level) are hints, not
  policy. The scheduler must never grant a stronger isolation label than
  the runner actually proved (see F15).

### Runner ⇄ session (direct machine, mode A)

Design: PTY in a git worktree, tmux-backed, as the user's own account.

- **F10 (high, accepted by design) There is no isolation in mode A.**
  The agent has the user's whole machine. This is what the user asked
  for and what Orca and herdr do. The mitigations are hygiene, not
  containment:
  - The UI labels mode A targets "full access" and never shows them as
    sandboxes.
  - Secrets injected into a mode A session are env vars in that shell
    only. Nothing written to disk by the runner.
  - The runner runs as an unprivileged user and never with sudo. If it
    needs to write launchd or systemd units, that happens during install
    with the user watching.
  - The egress proxy from note 02 is optional here. When enabled it adds
    per-session GitHub scoping and outbound logging. When disabled, the
    session simply uses the machine's own `gh` login.
- **F11 (medium) Worktree escape.** A worktree is a directory, not a
  boundary. Do not claim otherwise anywhere in the UI or docs.
- **F12 (medium) Scrollback on disk.** Off by default (herdr's reasoning:
  it contains secrets). If enabled per target, the file is 0600 and
  scrubbed with the same secret-value filter as the live stream.

### Runner ⇄ session (isolated VM, mode B)

Design: Firecracker microVM, jailer, overlay disk, persistent home volume,
tap on a bridge with NAT, vsock to the host, egress proxy on the host.

- **F13 (high) The persistent home volume is the crown jewel.** It holds
  the vendor login. Rules:
  - One volume per target per human, never shared between targets.
  - Mounted only into VMs for that target, read-write, one VM at a time
    (a lock on the host prevents two VMs from mounting it, which would
    also corrupt the filesystem).
  - Encrypted at rest on the host (LUKS or the host's disk encryption).
  - Never included in snapshots or VM images.
  - The agent inside the VM *can* read it. That is unavoidable and is
    the same as the agent reading `~/.claude` on a laptop. What we
    prevent is it leaving: the egress proxy blocks non-allowlisted hosts
    in "limited" mode, and we log every outbound host in every mode.
- **F14 (high) Egress proxy is the enforcement point, so it lives on the
  host, never in the guest.** The guest's only route is the host bridge.
  The host firewall drops anything from the tap that is not destined for
  the proxy or DNS. A guest that sets `HTTPS_PROXY` to nothing gets no
  network, not an unproxied network.
- **F15 (high) Isolation level must be proven, not declared.** The runner
  reports "vm" only after it has actually booted a Firecracker guest with
  the jailer on that host. A host without KVM is a "container" target in
  the UI, in a different color, with different defaults (no secrets by
  default, network limited).
- **F16 (medium) Jailer configuration.** chroot per VM, dedicated uid/gid
  per VM, cgroup limits, seccomp on by default, no host devices passed
  through beyond the tap and the two block devices. This is the
  Firecracker recommended production setup, not something we invent.
- **F17 (medium) vsock channel authentication.** The host runner only
  accepts vsock connections from the CID it assigned to that VM, and the
  guest agent authenticates with the JIT token injected at boot via
  kernel cmdline or a boot-time MMDS read. Never via a file in the
  rootfs image.
- **F18 (medium) Overlay disks and retention.** Task overlays hold source
  and possibly secrets written by the agent (`.env` it created). They
  are deleted on the retention deadline and on session delete, with a
  visible "this will destroy the disk" confirmation.
- **F19 (low) Docker inside the VM is root inside the VM.** Acceptable:
  the VM boundary holds. Do not mount the host docker socket into a
  guest, ever.

### GitHub and vendor credentials

Design (note 02): proxy-injected GitHub tokens, subscription CLIs log in
by themselves, API keys only for unattended runs.

- **F20 (high) The GitHub App private key is the most sensitive thing
  the control plane holds.** It mints installation tokens for every
  user. Keep it in a KMS or at least an environment-only secret, never
  in the database, and rotate it if the control plane is ever exposed.
- **F21 (medium) Installation tokens are repo-scoped and one-hour.** Mint
  per session with only the session's repos. The proxy additionally
  drops the token for any host other than `github.com` and
  `api.github.com`, and for any repo path outside the session's set.
- **F22 (medium) Vendor login URLs.** The "click to log in" feature shows
  an OAuth URL that the agent process printed. Only linkify when the
  host matches the vendor's known login hosts. See F3.
- **F23 (info) No credential ever crosses from the platform into a
  target.** Direct-mode: the machine already had it. VM-mode: the
  persistent home had it. The platform stores none of them. This is the
  policy statement to put in the docs and to keep true.

### Multi-tenancy

- **F24 (high, if ever multi-user) Every object is owned.** Users, orgs,
  projects, targets, secrets, sessions carry an owner and every query is
  scoped by it. A target belongs to exactly one human. Sharing a target
  is a feature we explicitly do not build in the MVP.
- **F25 (medium) Relay isolation.** The relay routes by session id, and
  a session id must be unguessable (128-bit random) *and* authorized by
  ticket (F1). Never expose a session id in a URL that can be shared
  without the ticket check.

### Supply chain and updates

- **F26 (high) Runner auto-update is remote code execution by design.**
  Updates are signed with an offline key, the runner verifies the
  signature before replacing itself, and the control plane can only
  *offer* a version, never push arbitrary binaries. Same for VM rootfs
  images: signed, content-addressed, verified by the host runner before
  boot.
- **F27 (medium) No skills or plugin marketplace.** Repo-local `.claude`
  directories only. Reaffirmed; this is the OpenClaw lesson.
- **F28 (medium) Pin base images and rebuild on a schedule.** The rootfs
  Dockerfile pins digests; a weekly rebuild picks up CVE fixes.

## 4. Tailscale: the perimeter, if you want one

Wanted but not required, so it is a layer that can be turned on without
changing the design.

What it gives us, cheaply:

- **The control plane is not on the public internet.** It listens only on
  the tailnet. Attacker D goes away entirely: no scanning, no brute
  force, no exposed relay.
- **Identity for free.** Tailscale nodes carry the user's identity; the
  control plane can read the caller's tailnet identity from the
  connection (Tailscale's `WhoIs`) and use it as a second factor on top
  of the GitHub login.
- **Runners join the tailnet too.** A target on a Mac Studio behind NAT
  reaches the control plane over the tailnet with no port forwarding on
  either side, which is the same property the outbound WebSocket gives
  us, plus mutual authentication at the network layer.
- **ACLs** decide which tags may talk to which: `tag:runner` may reach
  `tag:control` on the WebSocket port; users may reach `tag:control` on
  443; nothing may reach a runner inbound. VMs are *not* on the tailnet;
  they only see the host bridge.
- **MagicDNS and HTTPS certs** for `control.<tailnet>.ts.net` so the web
  app has a real certificate without a public DNS name.

How to build it in without making it mandatory:

- The control plane and the runner embed Tailscale as a library
  (`tsnet` in Go, which is one more reason the runner is Go). With a
  `--tailscale` flag and an auth key they listen on the tailnet; without
  it they listen on a normal interface behind whatever reverse proxy the
  user has. Same binary, two modes.
- Runner registration is unchanged. The registration token and keypair
  still authenticate the runner to the platform; Tailscale authenticates
  the network path. Belt and braces.
- Document the recommended deployment as "Tailscale on, control plane
  tailnet-only" and the fallback as "public HTTPS with a reverse proxy
  and mandatory 2FA on the GitHub account".

Limits to be honest about:

- Tailscale protects the perimeter. It does nothing about attacker A or
  B, which are the ones that matter most. F13 to F17 stand regardless.
- A browser session from a phone needs the Tailscale app on the phone.
  That is fine for a personal or small-team product.
- Tailscale Funnel could expose the control plane publicly for a webhook
  endpoint (GitHub App events). Prefer a tiny separate public receiver
  that only accepts signed GitHub webhooks and forwards them into the
  tailnet, so the main control plane stays private.

## 5. VM spec baseline: measured on the reference machine

The reference is the sandbox this research ran in, which is a Claude
Code on the web session. Measured on 2026-09-10:

| Dimension | Measured | Use as our default |
|-----------|----------|--------------------|
| Hypervisor | **Firecracker** (kernel `6.18.44-fc-v24`, virtio disk `/dev/vda`) | Firecracker, as planned in note 03 |
| vCPU | 4 × Intel Xeon @ 2.80 GHz, 1 thread per core, no vmx/svm exposed | 4 vCPU |
| Memory | 15 GiB, no swap | 8 GiB default on the slider, 16 GiB max |
| Disk | 252 GB virtio volume, ~30 GB writable allowance per session | 20 GB thin overlay per task, quota-enforced |
| OS | Ubuntu 24.04.4 LTS | Ubuntu 24.04 LTS rootfs built from a Dockerfile |
| Nested virt | none (`/dev/kvm` absent) | not exposed to guests; Docker inside does not need it |
| In-guest user | root, full capabilities, no seccomp inside the guest | same: the VM boundary is the sandbox, the guest is unrestricted |
| Docker | 29.x, daemon running inside the guest | Docker preinstalled and started by init |
| Toolchain | Node 22, Bun 1.3, Python 3.11, Go, git 2.43, tmux, ripgrep 14 | same list plus the Claude and Codex CLIs |
| Network | all egress via a local agent proxy; git credentials proxy-injected | egress proxy on the host, per note 02 |

Two things this confirms: Anthropic runs the exact architecture in note
03 (Firecracker guest, root inside, Docker inside, credentials outside),
and the 4 vCPU / 15 GiB shape is generous enough that the user's asked-for
4 to 8 GB range is a floor, not a ceiling. Make memory a per-target
slider from 4 to 16 GiB with 8 GiB default.

## 6. What to do before any real credential touches the system

Ordered by risk retired per hour of work:

1. F1, F6, F14, F15: per-session tickets, pinned control plane, egress
   enforced on the host, proven isolation levels.
2. F7, F20: encrypted job payloads, App private key out of the database.
3. F13, F17: home volume rules and vsock auth.
4. F26: signed runner and image updates, before the first auto-update
   ships.
5. Tailscale mode as the documented default deployment.

Everything in section 3 becomes an ADR or a test. None of it requires
new research; it is the same set of controls Claude Code on the web,
the Actions runner, and Actuated already run in production.
