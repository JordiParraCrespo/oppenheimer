# 12 — Test fleet

How the MVP is tested end to end with more than one host: one control
plane, many runners, a Mac Studio as the lab. The goal is speed first —
the loop a change goes through should be minutes on a laptop and in CI —
and realism second, in the lab, where the things a container cannot
fake (launchd, systemd user units, lingering, a real macOS login, real
wifi latency) are exercised on real operating systems.

Status: **proposal**, except Tier 1's fleet suite, which is built and
passes locally (§2, "As built"). The rest of the tiers and the topology are
recommended below; the open questions at the end are the owner's to decide
before they are built.

## What we need to prove, and where each thing can be proved

The runner and the relay already have their own tests: Go unit and
integration tests (tmux on a private socket), the gateway specs on a
real HTTP server, and `relay.e2e.spec.ts`, which runs the real runner
binary against the real relay with the rows faked (11, slice 6). What
nothing proves yet:

| Property | Needs | Cheapest place it is honest |
|---|---|---|
| Pairing through the real API and Postgres, not a faked row | API + DB + a runner that redeems a token | Containers |
| Several hosts on one account, a session routed to the right one | N runners, one control plane | Containers |
| Link loss, reconnect ladder, epoch, snapshot reconcile | A network you can break on purpose | Containers + a fault proxy |
| Runner killed or updated, tmux untouched, sessions adopted | A long-lived process tree | Containers |
| The install command, `curl \| sh`, idempotent re-run | A fresh OS with a real user | VMs |
| systemd user unit + `loginctl enable-linger`, boot survival | Real systemd, a reboot | Linux VMs |
| launchd user agent, quarantine strip, `KeepAlive` | Real macOS | The Mac Studio, macOS VMs |
| Signed self-update, health gate, rollback | A release manifest and a staging key | VMs against staging |
| Echo latency under 50 ms median (06's gate) | Real wifi, a real region | The Mac Studio against the Hetzner control plane |
| `claude` logs in and does a task | A real agent login | The Mac Studio, by hand |

So there are three tiers, and a test lives in the lowest tier that can
prove it.

## Decided (proposed)

### 1. Three tiers

```
 Tier 1 — fleet in a box            Tier 2 — the lab                     Tier 3 — staging
 (laptop, Mac Studio, CI)           (Mac Studio)                         (Hetzner)

 docker compose                     macOS (native) ── runner (launchd)   control plane: api + web
  ├─ postgres, redis                Lima: debian-12, ubuntu-24.04 ─┐      postgres, redis
  ├─ api  (built from the branch)   Lima: …, N Linux VMs           ├──►  real GitHub App (staging)
  ├─ github-stub, namer-stub        tart: 1–2 macOS VMs            │      runner channel: beta
  ├─ git-server (bare repos)        GitHub Actions runner (macOS)  │      staging signing key
  ├─ toxiproxy ── api                                               │
  └─ host-1 … host-N (runner)       every runner dials out ─────────┘
        all on one bridge network   (no inbound ports, Tailscale only for SSH)
```

- **Tier 1, fleet in a box.** Hermetic, seconds to start, the same on a
  laptop, on the Mac Studio and in CI. This is where almost every
  multi-host test lives and what makes development fast.
- **Tier 2, the lab.** The Mac Studio running real operating systems as
  hosts. Slower, stateful, run nightly and before a runner release, and
  by hand when working on install, service or update code.
- **Tier 3, staging.** The main server: one Hetzner box running the
  control plane from `main`, the same shape as production tier 1
  (Docker Compose, root `CLAUDE.md` "Deployment"). The lab's hosts pair
  with it. It is also where 06's latency gate is measured, because the
  gate is defined against a relay in a real region.

The main server is **not** the Mac Studio. A control plane on the same
machine as its hosts answers "does it work" but not "does it work over
the internet from behind a home NAT", which is the product's actual
topology (00 §"No ports on the host, ever"). The Mac Studio does run a
Tier 1 control plane for local work; staging is the one on Hetzner.

### 2. Tier 1: a host is a container

A new compose file, `docker/docker-compose.fleet.yml`, next to the dev
one, plus a host image, `docker/runner-host.Dockerfile`:

- **Base**: `debian:12-slim` with `git`, `tmux`, `ca-certificates`, a
  non-root user `dev`, and the runner binary copied in (built from the
  branch, `CGO_ENABLED=0`, so one `go build` serves every container).
  Not the distroless image: that one runs `serve` and has no tmux.
- **A `claude` shim** on `PATH`, the one `relay.e2e.spec.ts` already
  uses — prints its argv and execs a shell — so a session's launch argv
  is observable and the pane is interactive without an agent login.
- **Entrypoint**: if `~/.oppenheimer/config.json` is missing, `runner
  register` with the token in `RUNNER_REGISTRATION_TOKEN`; then
  run `runner run` under a small supervisor loop. The home directory is
  a named volume per host, so identity survives the container.
  Two restarts mean two different things here: killing the runner
  **process** (`docker compose exec host-2 pkill -f 'runner run'`) is
  "runner died, tmux survives" — the loop restarts it, exactly as
  launchd `KeepAlive` or systemd `Restart=always` would — while
  `docker compose restart host-2` takes tmux with it, which is "host
  rebooted" (02 §12).
- **Scaling**: `docker compose up --scale host=N`. One container is one
  host with its own Unix user, home, tmux server and key, which is the
  shape the product assumes (one runner per host, 02 §1).
- **Git without GitHub**: a `git-server` container serving bare
  repositories over HTTP (`git http-backend` behind a tiny nginx, or
  `git daemon`), seeded with the same repositories `github-stub.ts`
  lists. The runner hard-codes `https://github.com/<owner>/<repo>.git`
  (`internal/cli/link_sessions.go`), so the host image sets
  `git config --global url."http://git-server/".insteadOf
  "https://github.com/"` — no runner code changes, and the credential
  helper still runs because git still asks it.
- **Pairing is the real flow.** A seed step (`e2e/support/fleet.ts`)
  signs up a user, provisions the workspace, connects an installation
  on the GitHub stub, and mints one registration token per host through
  the real API; the tokens are handed to the containers. Nothing writes
  a host row directly, the same rule `support/sessions.ts` follows.
- **Fault injection**: the runners reach the API through
  [toxiproxy](https://github.com/Shopify/toxiproxy), not directly.
  A test can add latency, cut the link, or slice bandwidth per host,
  which is what the reconnect ladder, the epoch counter and
  `attachment.credit` need to be exercised honestly.

**As built** (`e2e/fleet/`, `e2e/support/fleet.ts`, `e2e/tests/fleet/`),
with three departures from the above, each forced by something the first run
found:

- **Plain `docker`, not Compose.** CI's runner has the daemon but not the
  Compose plugin, and a test wants to start and break hosts one at a time.
  The suite builds the runner for the daemon's architecture, bakes it into
  the image, and starts a network, the git server and each test's own hosts.
- **The API is forwarded onto each host's loopback**, by `socat`. The runner
  refuses plain HTTP to anything but loopback (`pairing/domain/identity.go`),
  which is right, so the host dials `http://localhost:3001` as a developer's
  machine would. The forwarder doubles as the network cable: `fleet-host cut`
  kills it with its connections. That covers link loss without toxiproxy;
  latency and bandwidth shaping are left for when a test needs them.
- **A host is matched by the name its token was minted with**, because that
  is the name the API keeps, not the one `runner register --name` sends.

Also as built, and a gap rather than a departure: the git server is
`git daemon` over `git://`, which asks for no credentials, so the
credential helper and `credentials.grant` are **not** exercised by the
fleet yet. Serving the repositories over HTTP with `git http-backend`
closes it. The CI job (§5 item 4) is not wired yet either; the suite runs
with `pnpm --filter @oppenheimer/e2e e2e:fleet` against a running API.

Three runs in a row, four specs, about a minute each. The run also recorded
that the runner still lays sessions out as `<owner>/<repo>/worktrees/<slug>`
rather than 10's `projects/` tree (02 §4 says so; R3 is the change), so the
suite asserts a session's branch, not its path.

A new Playwright project, `fleet`, next to `api` and `web`, drives it:

- pair N hosts and see N online in `GET /hosts`
- create a session on each host in parallel, attach, type, read the echo
- cut host-2's link: its sessions show offline, the others are
  unaffected; restore it: hello reconciles and the attachment resumes
- kill the runner process on host-3: tmux keeps the session, the new
  process adopts it, the browser reattaches to the same screen
- a session asked for on a host the caller does not own is refused
- two accounts, two workspaces, one host each: neither sees the other's

CI runs it in a job beside `End-to-End Tests (API)`, gated by
`scripts/ci/affected.mjs` on `apps/api`, `apps/runner`, `packages/go`
and `packages/shared`. Three hosts is enough for CI; the lab runs more.

### 3. Tier 2: the Mac Studio as the lab

The Mac Studio is the one machine that can run every supported host OS
at once. Apple silicon runs arm64 Linux and macOS guests at close to
native speed through Virtualization.framework.

- **Native macOS host.** The Mac Studio itself, paired to staging through
  the real install command, on the `beta` channel. This is the
  dogfooding host: once slice 6 lands, Oppenheimer is developed through
  Oppenheimer on it. It is also where 06's gate is measured by hand —
  a phone, real wifi, `claude` logging in through the printed URL.
- **Linux VMs with [Lima](https://lima-vm.io)**: one per supported
  distro (Debian 12, Ubuntu 24.04; add 22.04 if support is claimed).
  Lima is scriptable (`limactl start --name deb12 template://debian-12`),
  gives real systemd, so the user unit and `enable-linger` are tested
  for real, and can be deleted and recreated for a fresh-install test in
  under a minute. A `scripts/lab/` directory holds the templates and a
  `lab.sh up|down|reset|pair|smoke` wrapper.
- **macOS VMs with [tart](https://tart.run)**: fresh macOS installs for
  testing the install command and the launchd agent on a machine that
  has never seen the runner. Apple's licence allows **two** macOS VMs
  per Mac, so this is two, not a fleet.
- **Several macOS hosts on the metal** are separate macOS **user
  accounts**, not several runners under one account: the tmux socket
  name is the constant `oppenheimer` (`sessions/domain/session.go`),
  so two runners under one Unix user would share a tmux server and each
  would report the other's sessions as unclaimed. That is correct
  product behaviour (one runner per user per machine) and the lab
  follows it rather than working around it.
- **A self-hosted GitHub Actions runner** on the Mac Studio, labelled
  `macos-lab`, for the jobs that need macOS or the lab: the Go tests on
  darwin, and a nightly workflow that resets the Lima and tart VMs,
  installs the latest `beta` runner through the real install command,
  pairs them with staging, runs the `fleet` suite against staging, and
  tears down. Nightly and on `runner-v*` tags, never on pull requests:
  a pull request from a fork must never run on a machine in someone's
  home.
- **Reachability**: nothing on the Mac Studio is reachable from the
  internet. The runners dial out to staging like any user's host; the
  owner and CI reach the Mac Studio over Tailscale for SSH.

Sizing, as a starting point on a 64 GB machine: 6 Linux VMs at
2 vCPU / 4 GB, 2 macOS VMs at 4 vCPU / 8 GB, and the rest for the host
itself and a Tier 1 compose stack. The numbers scale with the machine
(open question 1).

### 4. Tier 3: staging

- One Hetzner box, `docker/docker-compose.prod.yml`, deployed from
  `main` by CI after the images are built and pushed to GHCR.
- Its own GitHub App (`oppenheimer-staging`), its own
  `CONTROL_PLANE_SIGNING_KEY`, its own domain. Staging data is
  disposable; no user of production is ever on it.
- **Runner releases**: staging's `RUNNER_RELEASE_CHANNEL` is `beta`.
  To exercise signed self-update without touching the offline
  production key (F26), a **staging release key** is compiled into
  beta-channel builds through the existing `release.PublicKeys`
  ldflag (`internal/updates/adapters/release/keys.go`). A beta binary
  therefore trusts the staging key and a stable binary never does. The
  staging key lives on the Mac Studio, not in CI, which keeps F26's
  shape — the machine that builds is not the machine that signs — at a
  lower stake.
- The Hetzner region is the one the production relay will use, so the
  latency numbers the lab records are the numbers users will see.

### 5. What this changes in the code

Small, and each in its own pull request:

1. `docker/runner-host.Dockerfile` and `docker/docker-compose.fleet.yml`
   (wrapped in `# oppenheimer:begin runner` markers, per the starter
   manifest).
2. A `git-server` seed and a toxiproxy config under `e2e/support/fleet/`.
3. `e2e/support/fleet.ts` and the `fleet` Playwright project; a root
   `pnpm fleet:up` / `fleet:down` / `test:fleet`.
4. The `End-to-End Tests (Fleet)` CI job and its row in
   `scripts/ci/affected.mjs`.
5. `scripts/lab/` (Lima and tart templates, `lab.sh`) and the nightly
   `lab.yml` workflow on the `macos-lab` runner.
6. Staging deploy job and the beta-channel release key wiring in
   `release-runner.yml`.

No runner or API behaviour changes. If a test needs a seam that does
not exist, the seam is added as a development override in the same
style as `RUNNER_HOME` and `RUNNER_WORKSPACES`, documented in the root
`.env.example`.

### 6. Order

Tier 1 first, because it pays back every day and needs nothing but
Docker: items 1–4 above. Then staging (item 6's deploy half), because
the lab has nothing to pair with until it exists. Then the lab (item 5)
and the beta signing key, which are what runner releases need before
the first real user installs one.

## Open questions

1. The Mac Studio's chip and memory, which set how many VMs the lab
   runs at once. The plan above assumes 64 GB.
2. Whether the Mac Studio also serves as a general self-hosted CI
   runner for pull requests from the owner's own branches (faster than
   `gha-vm` for Go and Docker builds), with forks excluded by workflow
   condition. Recommendation: yes for the owner's branches, never for
   forks.
3. Whether staging should also run a handful of always-on Linux hosts
   on Hetzner (a CX22 each) so the fleet suite can run against staging
   when the Mac Studio is off. Recommendation: one, as a canary, once
   the nightly run exists.
4. Whether to add `amd64` Linux coverage in the lab (Lima can emulate
   x86_64 through QEMU, slowly) or rely on the Hetzner canary for it.
   Recommendation: the canary, since Hetzner's shared-vCPU boxes are
   amd64 and they are the likely first real hosts.
