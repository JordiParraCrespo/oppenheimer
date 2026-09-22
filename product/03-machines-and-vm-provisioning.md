# 03 — Connecting machines and provisioning VMs

Prior art reviewed: herdr (agent terminal multiplexer, Rust), the GitHub
Actions self-hosted runner (registration and auth design), and Actuated
(Firecracker microVM per CI job on your own hosts). Each solves one slice
of our problem well, and together they cover almost all of it.

## 1. herdr: what to copy

herdr is a single Rust binary that is both client and server. The server
owns every PTY, child process, and layout. Clients only render and send
input. That is the same "daemon owns the PTY" rule we took from Orca's
relay, arrived at independently, which is good evidence it is the rule.

How it connects to machines:

- `herdr machine add workbox` saves an SSH machine. The local binary
  becomes a thin client to a herdr server on the remote, over SSH. The
  remote needs herdr installed; there is no auto-deploy like Orca's relay.
- Each machine reconnects independently. Disconnects do not stop agents
  because the server on the remote keeps running.
- Layout and working directories are restored after a server restart,
  but child processes die. Scrollback persistence is off by default on
  purpose, since scrollback contains secrets. Cooperative agents (Claude
  Code, Codex) report their native session id so the conversation can be
  resumed after a restart even though the process was lost.

What we take:

1. **Agent state detection, two layers.** Process identity of the pane's
   foreground process, plus "screen manifests": small rule sets matched
   against the bottom region of the live screen to classify the pane as
   `working`, `blocked`, `done`, `idle`, or `unknown`. This is how the
   board knows an agent is waiting for approval without parsing the whole
   stream, and without any agent integration. We implement the same
   thing in the runner, per pane, and ship manifests for Claude Code and
   Codex first.
2. **Resume by native session id, not by process resurrection.** After a
   runner or VM restart we relaunch `claude --resume <id>` instead of
   pretending the process survived. The runner records the id from the
   agent's hook or from the screen.
3. **A socket API with wait conditions.** `agent prompt` that blocks until
   the target agent is settled is the primitive that makes delegation
   work without a DSL. Our control plane exposes the same verbs over
   HTTP, and the MCP server from note 00 is a thin wrapper around them.
4. **Do not persist scrollback by default.** Ring buffer in memory for
   reattach, nothing on disk unless the user opts in per target.

What we do not take: SSH as the transport. herdr, like Orca, needs a
reachable SSH port. Our runner dials out.

## 2. GitHub Actions runner: copy the registration and auth design

The self-hosted runner has run on millions of machines behind every kind
of firewall. Its design doc is short and we should copy it nearly
verbatim for target registration.

Registration:

1. The UI shows a **registration token**, valid for one hour, and an
   install command that embeds it.
2. The runner generates an **RSA keypair** locally. The private key stays
   on the machine, file-permission protected. It sends the public key
   plus the registration token to the control plane.
3. The control plane stores the public key and returns a **clientId**.
   The registration token is now spent. The user's own credentials were
   never on the machine.

Every boot:

4. The runner signs a short JWT with its private key and exchanges it for
   a **short-lived session token**. That token only grants access to the
   runner's own message channel.
5. It opens an outbound connection and waits for work. Actions uses a
   50-second HTTPS long poll; we use a WebSocket with heartbeat, since we
   also stream PTY bytes on it. Both are outbound-only.

Per job:

6. When a session is scheduled, the control plane mints a **per-session
   token** whose lifetime is the session plus a grace window. The job
   message, including that token and the secret bundle, is **encrypted to
   the runner's public key**, so the control plane's own transport and
   logs never hold plaintext secrets.
7. The runner hands the token to the session process as environment
   variables, never to disk, and scrubs it from logs.

Two runner flavors, both of which we want:

- **Persistent**: a registered target that stays online and takes many
  sessions. This is mode A from note 02.
- **Ephemeral / just-in-time**: registered for exactly one job with a
  one-shot config, deregisters when the job ends. This is the identity a
  fresh VM gets in mode B. The host runner mints the JIT config, injects
  it into the VM at boot, and the VM's in-guest agent registers itself.

## 3. Actuated: Firecracker microVM per job on your own hosts

Actuated is a hosted control plane plus an agent you install on your bare
metal or nested-virt servers. For each GitHub Actions job it boots a
single-tenant Firecracker microVM with an immutable root filesystem and
Docker already running, GitHub's runner registers from inside, and the VM
is deleted when the runner exits. Boot to ready is one to two seconds.

Lessons they published after running it at scale:

- **Images: 80/20.** Do not replicate GitHub's 3,000-package runner image.
  A lean Dockerfile with the common toolchains (Node, Python, Go, build
  tools, docker) covers most jobs; add on request. Build the rootfs from
  a Dockerfile so it is reproducible.
- **The VM is fast; everything around it is slow.** Sub-second boots, but
  webhook delivery, API rate limits, and DNS on the host dominated
  incidents. Design for out-of-order and missing events.
- **Docker Hub rate limits** bite self-hosted VMs harder than hosted
  runners. Run a pull-through registry cache on the host.
- **Autoscaling is hard when you cannot predict which VM gets which job.**
  We avoid this entirely: our scheduler assigns a session to a specific
  target before creating the VM, so there is no pool to size.
- Most ongoing work was onboarding and support, not the hypervisor.

## 4. How we build the VM provisioner (mode B, Linux host)

Firecracker mechanics, in the order the runner performs them:

| Step | Mechanism | Notes |
|------|-----------|-------|
| Kernel | one `vmlinux` per architecture, shipped with the runner | Firecracker boots an uncompressed kernel directly, no bootloader |
| Root filesystem | ext4 image built from a Dockerfile, read-only base | rebuilt by CI, versioned, cached on the host |
| Per-task disk | copy-on-write overlay on the base (device-mapper snapshot on the host, or overlayfs in the guest) | task writes go to a thin layer, base stays immutable |
| Persistent home | second block device, one per target, mounted at `/home/agent` | keeps CLI logins and caches across VMs (note 01 §7) |
| Repo | cloned into the overlay at boot by the in-guest agent, using the proxy-injected GitHub token (note 02) | shallow by default |
| Networking | one `tap` device per VM attached to a host bridge, iptables NAT to the host's uplink | the VM gets a private IP, no inbound |
| Egress policy | the VM's only route is the host; the host runs the credential-injecting egress proxy from note 02 | network modes: trusted / limited / none |
| Host ↔ guest channel | `vsock` | the in-guest agent talks to the host runner over vsock, not the network, for PTY bytes, file ops, and status |
| Sandbox | Firecracker's `jailer`: chroot, cgroups, seccomp per VM | free hardening, use it from day one |
| Budget | vCPUs and memory set at create time, 2 vCPU / 4 GB default, 8 GB max on the UI slider | cgroups enforce it |
| Docker inside | dockerd started by the guest init, storage on the overlay | Docker in a VM, not Docker in Docker |
| Warm start | optional: snapshot a booted VM with the base image and restore per task | takes boot from ~1 s to ~150 ms, but snapshots pin a kernel version; phase-later |
| Teardown | on session close or retention expiry: kill VM, drop overlay, keep home volume | the runner reports final state to the control plane |

Lifecycle as the control plane sees it:

```
requested → provisioning (image ready, overlay created, VM booting)
          → ready (in-guest agent registered with JIT identity, repo cloned, setup script done)
          → running (PTY open)
          → paused (idle timeout: VM paused, memory kept)   ⇄ running
          → stopped (session closed: VM killed, overlay kept for retention)
          → destroyed (overlay dropped)
```

Other hosts, same interface:

- **macOS host**: Apple Virtualization.framework through `tart` or `lume`.
  Linux guests boot in seconds, Docker works, and the persistent home
  volume is a shared directory. Same lifecycle, different backend.
- **Cloud**: the "runner" is an adapter in the control plane that calls
  a provider API (Hetzner Cloud, Fly Machines, EC2) to create a VM from
  our image, and the in-guest agent registers with the JIT identity
  exactly like a Firecracker guest. No daemon on any host.
  *Superseded by note 14*: the cloud VM runs the ordinary runner,
  paired by cloud-init with an ordinary pairing token, and the adapter
  is a machine-lifecycle port with no session knowledge.
- **Docker-only host** (no KVM, e.g. a cheap VPS): a container instead of
  a VM, with the same in-guest agent. Weaker isolation, clearly labelled
  in the UI as "container, not VM".

## 5. Service decomposition

Turborepo, yes. Microservices on day one, no. Split by package boundary
now and by process later, when one of them needs to scale or deploy
independently. The seams are:

```
apps/
  web            Next.js. Projects, targets, board, terminal, settings.
  control        One Node process with these modules behind clear interfaces:
                   identity   users, orgs, GitHub App auth, API tokens
                   fleet      target registration (RSA/clientId), heartbeats, capabilities
                   scheduler  task → session → target, VM lifecycle state machine
                   relay      WebSocket hub: browser ⇄ runner, PTY bytes routed by session id
                   vault      encrypted secrets, per-session bundle, token minting
                   events     append-only session log, SSE fan-out to browsers
  runner         One Go or Rust binary, subcommands:
                   agent      mode A: node-pty-equivalent PTYs, tmux-backed, screen manifests
                   hypervisor mode B: Firecracker/tart lifecycle, overlay disks, tap/bridge, vsock
                   guest      the in-guest agent: registers JIT identity, clones, runs setup, opens PTYs
                   proxy      the credential-injecting egress proxy from note 02
packages/
  protocol       zod (or protobuf) schemas: registration, job, event, heartbeat, PTY frames
  db             Drizzle schema and migrations
  manifests      screen manifests for Claude Code, Codex, and generic shells
  images         Dockerfiles that build the VM rootfs and the runner container
```

Two changes from note 00's stack, both driven by this research:

- **The runner should be Go or Rust, not Node.** Every project here
  that runs on other people's machines (herdr, the Actions runner,
  Actuated's agent, Firecracker's own tooling) is a single static binary.
  node-pty's native build failures are Orca's top install complaint, and
  a Firecracker/vsock/tap orchestrator in Node is fighting the language.
  Go has first-class Firecracker (`firecracker-go-sdk`), vsock, and
  netlink libraries and cross-compiles to every target with one command.
  The web app and control plane stay TypeScript; the protocol package is
  the contract between the two languages, which is why it should be
  protobuf or JSON Schema rather than zod-only.
- **The relay is the first thing to split out** when it is time. It is
  stateless, bandwidth-heavy, and latency-sensitive, and it is the only
  piece that benefits from running close to the targets.

## 6. What this changes in the phase plan

Phase 1 (persistent terminal from a browser) now includes the Actions-
style registration flow, since a target without a real identity is
throwaway code. Phase 6 (mode B) starts with the Firecracker table above
on one Linux host, with the JIT guest identity, before any cloud adapter.

## Sources

- herdr: <https://github.com/herdrdev/herdr>, <https://herdr.dev/docs>,
  <https://www.developersdigest.tech/blog/herdr-deep-dive-agent-terminal-multiplexer>
- GitHub Actions runner auth design: <https://github.com/actions/runner/blob/main/docs/design/auth.md>
- Actuated: <https://actuated.com/blog/managing-github-actions>,
  <https://blog.alexellis.io/blazing-fast-ci-with-microvms/>
- Firecracker: <https://github.com/firecracker-microvm/firecracker>
