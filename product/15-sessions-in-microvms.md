# 15 — Sessions in microVMs, the way Anthropic runs them

Decision, 2026-09-22: **v0.2 runs a session as a Firecracker microVM on
a host with KVM, with the lifecycle Claude Code on the web uses.** The
VM exists only while the session is active; its disk is kept; a wake
boots a fresh VM on that disk in a couple of seconds; the guest is
driven over vsock and reaches the network only through our proxy; the
image is prebaked. The host is your own Hetzner box first, and the
provider port of note 14 rents a KVM-capable host when you have none,
rather than one cloud VM per session.

Three earlier decisions change with it and are recorded in
`README.md`: note 08's "libvirt first, Firecracker later"; note 14's
"one provider VM per session, paired as a host"; and note 10's three
sleep tiers, which collapse to two states for a microVM session. The
design lands in the MVP notes that own each piece — `versions/mvp/02`
§14 (the runtime), `04` (the image), `03` §Cloud hosts (the port, the
policy), `10` (the columns), `07` (the findings) — and this note is
the research behind them.

## 1. What this session is, read off the machine

The session that wrote this note was inspected from inside, on
2026-09-22, an hour into the conversation:

| Fact | Observed |
|---|---|
| Hypervisor | a Firecracker kernel (`6.18.44-fc-v37`); PID 1 is `/process_api --firecracker-init`, listening on **vsock** port 2024 with logs on 5002 |
| Shape | 4 vCPU, 15 GiB RAM, one virtio root disk of 256 GiB with a 30 GB write allowance, two read-only squashfs drives for skills |
| Uptime | **46 seconds**, in a conversation over an hour old; the kernel log showed a fresh boot mounting the root disk "unchecked" because the previous VM had simply been stopped |
| Resume | `environment-manager task-run --session-mode resume` relaunched the CLI with `--replay-user-messages`; the session's OAuth and ingress tokens were rewritten at that moment; a worker-epoch counter read 4 |
| Network | a local proxy on `127.0.0.1` tunnelling to a policy-enforcing egress proxy that re-terminates TLS with a preinstalled CA and resolves hostnames itself; git rewritten from SSH to HTTPS with the credential injected per request; no `ip` binary in the image |

So Anthropic's "resume" is a **boot on the kept disk**, not a memory
restore: between turns the VM does not exist, only its disk does, and
a message boots a new one. That is note 10 §1's hibernate column with
a two-second boot. The published docs say the same in product terms:
"each session runs in an isolated, Anthropic-managed VM", "a fresh VM
running Ubuntu 24.04 on x86_64", sessions stop after inactivity and
"the session's VM is reclaimed", reopening "provisions a fresh VM with
your conversation history restored", and background work is not
restored. A third-party look in November 2025 found a `runsc` hostname
and the same `process_api` on port 2024 — a gVisor container then, a
Firecracker VM now. Anthropic's May 2026 "How we contain Claude"
describes the family: gVisor for claude.ai code execution, full VMs
for Cowork with credentials outside the VM and an in-VM proxy, and a
red-team exfiltration through an allowlisted domain as the lesson.
What is not published: the process API, the vsock ports, or the
`environment-manager`; the table above is observation, not
documentation.

## 2. The decision, and what it replaces

**A session is a microVM.** On a host with KVM, the runner boots one
Firecracker VM per session from a prebaked root image, on a disk that
belongs to the session. The VM runs while the session is active. When
the session is idle (the control plane's call, `versions/mvp/03`), the
guest agent syncs and unmounts, the VM is killed, and the disk stays.
The next message boots a new VM on that disk: tmux comes up, the agent
is relaunched with its own resume flag, the terminal shows the tail of
the old scrollback above a live prompt. Delete drops the disk.

**Two states, not three tiers.** Note 10 §2's pause-in-RAM, managedsave
and hibernate were tuned to a libvirt guest that took tens of seconds
to boot. A microVM that boots in about two seconds on its kept disk
makes the RAM tiers pointless: running or stopped, and stopped costs
disk. Firecracker snapshots (memory restore in tens of milliseconds)
stay as a later optimisation for a warm resume, with the constraints
§4 lists.

**The host runs many.** One KVM host holds several sessions: the
Hetzner box first, since it already runs KVM guests (note 08), and a
rented KVM-capable host through note 14's port when the person has no
box. That port's design holds word for word — a cloud machine is a
host that pairs itself — but the machine it creates is a *host* sized
for six to eight sessions, not a VM per session, and the pause and
resume of note 14 §7 become the microVM's, with the host's own
stop/start a ladder below them (§6).

What this replaces:

| Was | Now | Why |
|---|---|---|
| Note 08 §4: libvirt/KVM first, Firecracker later, reuse the CI controller | Firecracker first; the controller's image script, capacity gate and reconcile-on-boot are reused as ideas, not code | the lifecycle *is* the boot time: a tens-of-seconds cloud-init boot per wake is not "like Anthropic", and libvirt's managedsave is what the three tiers existed to use |
| Note 14 §2, §7: one provider VM per session, hibernate on AWS as the warm path | one provider *host* for many sessions; warm resume is a Firecracker snapshot, not EC2 hibernation | a per-session cloud VM costs a boot of 45 to 90 s on two of three providers and a public IP each; a host boots once and its microVMs boot in seconds |
| Note 10 §2: three sleep tiers | two states | above |
| Note 11 §2: Keep sessions share a workspace VM per project | a VM per session, always; the shared workspace VM stays on the shelf | Anthropic does per session; with a two-second boot and a reflinked disk the sharing buys little, and the isolation is simpler to state |
| Note 03 §4, note 08 §2: tap on a bridge, NAT, firewall rules | **no NIC in the guest**; all egress over vsock to the host proxy | F14 by construction rather than by iptables (§4) |

## 3. The lifecycle, verb by verb

```
create ──► base image reflinked to a session disk (ms) ──► boot (~2 s) ──► guest agent up on vsock ──► clone, setup, tmux, agent
   │                                                                                     │
   │                                              idle N min (control plane) ◄───────────┘
   ▼                                                        │
running ◄──── resume: boot on the kept disk, agent --resume ─┤
                                                            ▼
                                                   stopped: disk only ──(Delete, or 7 d)──► deleted: disk dropped
```

- **Create.** The runner reflinks the base root image into the
  session's disk file (XFS or btrfs on the host, one to four
  milliseconds; a full copy is seconds), sizes it to the session's
  allowance as a sparse file, and boots: `vmlinux`, the disk as the
  root device, vsock, no NIC, the jailer around it. The guest agent is
  PID 1. Firecracker's own target is 125 ms to `init`; a lean image
  with `dockerd` is under a second in Actuated's numbers; two seconds
  is the budget to a live prompt.
- **Session bundle.** The host connects to the guest's vsock port and
  hands it the session: ids, the layout, the launch, the first task.
  The guest clones through the proxy (§4), runs the setup, starts tmux,
  launches the agent. The boot-trace rows are the same events as
  `versions/mvp/03`.
- **Active.** PTY bytes, resize, window open and close, and the screen
  manifest ride vsock between the guest agent and the host runner; the
  runner relays them on the link exactly as it relays a tmux on the
  host today. The wire between browser, control plane and host does not
  change (`versions/mvp/01`).
- **Stop.** The control plane sends `session.stop` with `push: true`
  (already decided); the guest pushes, `sync`s, unmounts, and reports;
  the runner kills the VM. The disk keeps its ext4 journal, so a VM
  that dies without the unmount replays on the next boot instead of
  booting "unchecked".
- **Resume.** `session.restart` boots a VM on the kept disk; the guest
  relaunches tmux window 0 with the agent's own resume flag and the
  session id recorded continuously (`versions/mvp/02` §5 and §9), and
  the fresh repository token arrives over vsock before the prompt is
  live (note 10 §3).
- **Delete.** `session.close`, then the disk file is removed (F18). The
  account volume, when the accounts slice arrives, is a second block
  device and outlives the session (F13).

**Idle stays the control plane's decision** and the guest never powers
itself off; the runner reports, the control plane acts (the rule from
the note 14 review). On a microVM host the runner's action is a
`kill`, which is free; the *host's* stop is a separate decision (§6).

## 4. Inside the guest

**No network device.** The VM has a root disk and a vsock and nothing
else. The guest agent listens on `127.0.0.1` as an HTTP `CONNECT`
proxy and forwards each connection over vsock to the runner's egress
proxy on the host, which enforces the environment's allowlist
(trusted, limited, none: the modes note 02 named), re-terminates TLS
with a CA the image trusts, and injects credentials in flight —
the one-hour repository token into `github.com` requests, so the guest
never holds it and the credential helper of the MVP is not needed
there. `HTTPS_PROXY`, `NO_PROXY` for loopback, and the CA path are set
for every process, `dockerd` included. Anything that is not HTTP over
the proxy does not exist, which is what "network: none" should mean
and what F14 asked for; the tap, bridge, NAT and firewall of note 03
§4 and note 08 go away. Git over SSH is rewritten to HTTPS, as
Anthropic does. A userspace netstack over vsock (gVisor's
`gvisor-tap-vsock`) is the answer if raw TCP to arbitrary hosts is
ever needed; it is not, in v0.2.

**vsock, two ports.** Firecracker maps guest `AF_VSOCK` ports to Unix
sockets on the host. The host dials the guest (`CONNECT <port>` on the
device's socket) for the control channel — the session bundle, PTY,
commands, the manifest state — and the guest dials the host for the
proxy and for log streaming, on a second port. Firecracker 1.17 halved
host CPU per gigabit of host-to-guest vsock traffic. In Go the guest
uses `mdlayher/vsock` (v1.3.0, May 2026); `firecracker-go-sdk` is
unarchived but its last release is from 2022 and it lags the API, so
the runner drives Firecracker's REST API over its socket directly.

**F17 gets simpler.** The guest has no credential to the control plane
at all: it talks only to its host over a device only its host can
reach, the host identifies the VM by the CID it assigned, and the
runner's own host key is the identity on the link. Nothing is injected
on the kernel command line but the boot arguments.

**The image** is `versions/mvp/04`: Ubuntu 24.04 from a Dockerfile,
exported to a raw ext4, with git, tmux, Node, Claude Code, Codex,
Docker, the common toolchains, `chrony`, the proxy CA, and the guest
agent as `init`. Signed with the offline key, the rootfs half of F26.
Read-only squashfs drives for things that change more often than the
image — the agent CLIs, skills — are the trick Anthropic uses for
skills and are worth copying the day the image rebuild becomes the
bottleneck. Root inside the guest, as decided in `04`.

**Docker inside** is a real daemon in a real VM, note 10 §8's argument,
at no extra cost.

## 5. On the host

**Firecracker, jailed.** v1.17.0 (September 2026). The jailer gives
each VM its own chroot, uid and gid, cgroup, mount namespace, and the
seccomp filters are on by default; the production guide adds
per-VM users, KSM off, no swap, SMT off for untrusted tenants. Host
kernel 6.1 or 6.18, x86_64 or aarch64, `/dev/kvm`. VMM overhead is
under 5 MiB per VM.

**Disks.** Firecracker takes raw images only, never qcow2 (which is
what note 08's controller uses; it does not carry over). The base
image is a raw ext4 file; each session disk is a **reflink** of it on
an XFS or btrfs host filesystem, so create is milliseconds and the
disk shares blocks with the base until written. A session disk is a
sparse file of the allowance size, which is the quota; `discard` on
the drive (1.17) punches freed blocks back out. The guest sees one
writable root, as Anthropic's does; the alternative — a read-only base
drive plus a writable overlay assembled by the guest with overlayfs,
e2b's shape — saves nothing on a reflink host and puts a filesystem
trick in the guest. Live resize exists but only for an unmounted
drive; grow the file before boot instead.

**Density.** Note 10 §8's arithmetic holds and improves: a 2 vCPU / 4
GB session at 2:1 CPU overcommit, memory faulted lazily so an idle
guest holds far less than its ceiling, the balloon with free-page
reporting for the rest, and `vm.overcommit_memory=1` **not** set, on
Firecracker's advice. Eight sessions on an eight-core, 64 GB box;
three to four on a rented 4 vCPU / 16 GB host, six to eight on 8 / 32.
Northflank reaches a P99 readiness of 733 ms at a hundred thousand
sandboxes; we need eight.

**Snapshots, later.** Firecracker's snapshot and restore is how Lambda
and e2b resume in tens to hundreds of milliseconds, and it comes with
a list: the same Firecracker version, kernel and CPU template on
restore; network not guaranteed; the guest clock continues from the
snapshot; "resuming from the same state more than once" is
documented as insecure, so a snapshot is loaded once and then
terminated; e2b pays about four seconds per GiB to pause. For an idle
pause of minutes on a homogeneous fleet it wins; for hours and days
across upgrades, the boot on the kept disk avoids every constraint,
which is why Anthropic does it and why it is v0.2's only path.

**Which host.** A Firecracker host needs `/dev/kvm`: bare metal, or a
VM with nested virtualisation. Checked 2026-09-22:

| Host | KVM via | Shape for 6 to 8 sessions | Per hour | Stopped | Boot | Notes |
|---|---|---|---|---|---|---|
| **Your Hetzner dedicated box** | metal | AX41-1-LTD 12 threads / 64 GB €57.30 a month, no setup; AX42-1-LTD 16 / 64 GB €77.30 plus €39 | €0.08 to €0.10 amortised | billed in full, so it stays on | minutes, once | the June 2026 repricing moved the AX42-1 to €97.30 a month; note 10 §4's €47 to €57 predates it |
| **AWS EC2** | nested virtualisation on virtual instances since **2026-02-16**, Intel families only (C7i, C8i, M7i, M8i, R7i, R8i and their `-flex`), `--cpu-options NestedVirtualization=enabled`, changeable while stopped | m8i.2xlarge 8 / 32 | $0.507 Frankfurt, $0.198 spot; m8i.xlarge 4 / 16 $0.254 / $0.103 | EBS only | 10 to 40 s | no Graviton; AWS points latency-sensitive work at metal; spot is not documented either way |
| **Oracle Cloud** | nested virtualisation present on E5.Flex (AMD) and Standard3.Flex (Intel); not on A1 | E5.Flex 4 OCPU / 32 GB | $0.184, preemptible $0.092; 2 OCPU / 16 GB $0.092 | boot volume only, counts against limits | one to three minutes | Oracle's own Firecracker benchmark: CPU −3.5 %, but random 16 KiB I/O **−79 %** against bare metal; the $300 trial spends on E5, Always Free does not cover it |
| **Alibaba Cloud** | bare metal only, 104 vCPU and up | — | several dollars an hour | economical mode unlikely | minutes | not a fit for a personal workspace |
| Hetzner Cloud | **none**: "nested virtualization is not possible on cloud servers" | — | — | full price | — | out |
| Azure D4 v5, GCP N4 | nested virtualisation | 4 / 16 | $0.19; Azure spot $0.04 | disks only | 30 to 60 s | further drivers of the same port |
| Latitude.sh | metal, hourly | m4.metal.small 12 threads / 48 GB | $0.41 | delete | 15 s to 5 min | the cheapest hourly bare metal if nested virtualisation disappoints |

Reading it: the dedicated box is still the daily answer, the AX41-1-LTD
being the cheap one now; EC2 m8i and OCI E5 are the two hosts worth
renting, and the provider order of note 14 stands — AWS first, Oracle
second — with the shapes changed from a VM per session to a host per
person. Alibaba drops to "when a user brings a bare-metal account".
Nested virtualisation costs a few percent of CPU and a lot of random
I/O, which is `npm install` and `git clone`; worktrees on a tmpfs or
the host's local NVMe recover most of it.

## 6. Pause, resume, delete, at two levels

| Level | Pause | Resume | Delete | Who decides |
|---|---|---|---|---|
| **Session (microVM)** | after 30 idle minutes: push, sync, unmount, kill; disk kept | boot on the kept disk, agent `--resume`; about two seconds plus the agent | drop the disk | the control plane's sweeper, as decided in the note 14 review |
| **Rented host** | when no session on it has run for N minutes (default 30): the provider's stop; on Oracle and Alibaba the API stop, never an OS shutdown | the provider's start, then the runner's user service, then the session boots; 10 to 40 s plus two on AWS | destroy the host after 7 days with nothing running on it, or on Disconnect; session disks on it are pushed and gone | the same sweeper, one level down |
| **Own host** | never | — | — | it is on |

A rented host is note 14 §7's machine with the verbs moved: `stop`
and `start` are the host's, `suspend` is never needed (the session
state is on disk inside the host's disk, and EC2 hibernation of a host
holding stopped microVMs buys nothing), and the port's fail-closed
`suspend` stays for a driver that wants it later. The recreate path
of note 14 §7 — a start the provider refuses — recreates the *host*
and every session disk on it is gone, which is why session disks on a
rented host are pushed at every pause and why the account volume, when
it comes, is a provider volume and not a file on the host's disk.

## 7. Security, mapped onto note 04

| Finding | In v0.2 |
|---|---|
| F13 account volumes | a second block device per account, attached to one VM at a time; the accounts slice |
| F14 egress proxy on the host, never in the guest | by construction: no NIC; the guest's only route is vsock to the host proxy |
| F15 isolation proven, not declared | the runner reports `vm` only after it has booted a jailed Firecracker guest on that host; a host without `/dev/kvm` offers the `host` runtime only |
| F16 jailer configuration | chroot, uid and gid, cgroup, seccomp per VM, from the production guide; no host devices but the disks and the vsock |
| F17 vsock authentication | the guest has no control-plane credential; the host trusts a VM by its CID, and only the host can reach the device |
| F18 overlay disks and retention | session disks deleted on Delete and after the sleep window, with the confirmation |
| F19 Docker is root inside the VM | accepted; the host's docker socket is never in a guest |
| F26 rootfs images signed | the image is a signed artifact of the same release pipeline as the runner |

What the observed session adds to the list: the exfiltration path
through an *allowed* domain that Anthropic's own red team used. The
allowlist is a boundary against accidents, not against the agent; the
platform's real credential boundary is that the guest never holds one.

## 8. What a session costs now

For note 10 §10's workload — ten sessions, four hours each on 22
working days, 880 session-hours, six to eight per host at once:

| Where | Host | Running | Asleep | Month |
|---|---|---|---|---|
| Own Hetzner AX41-1-LTD | one, always on | flat | free | **€57** |
| AWS m8i.2xlarge, Frankfurt | one host, on while any session runs | $0.507 on demand, $0.198 spot | EBS, a few dollars | about **$60 to $75** on demand for ~130 host-hours; **$30** on spot |
| Oracle E5.Flex 4 OCPU / 32 GB | one host | $0.184 | boot volume $2 | about **$25**; the $300 trial covers a year of it |

Compared with note 14's per-session VMs (AWS $135, Oracle $56, Alibaba
$121 to $172 for the same 880 hours) the host model is two to five
times cheaper, because eight sessions share one machine and idle
sessions cost nothing at all. The model is still the bill; compute is
still one to five percent of a task (note 10 §8).

## 9. What we looked at and did not take

- **libvirt/KVM and the existing CI controller** (note 08): qcow2
  overlays, cloud-init guests and managedsave are the wrong primitives
  for a boot-per-wake lifecycle; the ideas (golden image script,
  capacity gate, reconcile-on-boot, "no host mounts in the guest")
  carry over, the code mostly does not.
- **Cloud Hypervisor**: qcow2 and a broader device model, and Depot
  got it to 0.8 s boots; Firecracker is what Anthropic, fly, e2b,
  Northflank and Actuated run, has the jailer, and boots faster with
  less. Behind the same runner interface if a reason appears.
- **gVisor** (`runsc`): what Anthropic used a year ago and still uses
  for claude.ai code execution; no Docker daemon inside, a kernel
  shared with the host. Note 10 §8's VM decision stands.
- **A netstack over vsock**: only if raw TCP to arbitrary hosts is
  needed; an HTTP proxy over vsock is smaller and stricter.
- **Snapshots as the resume path**: §5.
- **`firecracker-go-sdk`**: stale; the REST API over the socket is a
  few hundred lines.
- **Hetzner Cloud as a host**: no nested virtualisation; it stays the
  control plane's home, not a session host.

## 10. Order of work

1. **The image and the guest agent** (`versions/mvp/04`, `02` §14): a
   Dockerfile to a raw ext4, the guest agent as `init` with the vsock
   control channel, the PTY bridge, the proxy forwarder, the CA. Done
   means: `firecracker` on the Hetzner box boots it to a tmux prompt
   in under two seconds and `claude` in the guest reaches the API
   through the proxy and nothing else.
2. **The microVM runtime in the runner** (`02` §14): Firecracker over
   its socket, the jailer, reflinked disks on an XFS volume, boot and
   kill, reconcile on boot, `runtime: microvm` on `session.create`,
   the runner's `vm` capability only after a proven boot (F15). Done
   means: the demo scene with the host chip on `hetzner · Clean VM`,
   stop typing for thirty minutes and the VM is gone with the disk
   kept, open it from the phone and the agent resumes on a fresh boot.
3. **The egress proxy on the host** (F14) with the allowlist modes and
   repository-token injection, which retires the in-guest credential
   helper for microVM sessions.
4. **Rented KVM hosts** through note 14's port: AWS m8i with nested
   virtualisation first, OCI E5 second, the host-level stop ladder,
   the AWS quota request on day one, the OCI trial started when the
   driver is a week away.
5. **Later**: Firecracker snapshots for a warm resume; read-only
   squashfs drives for the agent CLIs; the account volume (F13); the
   shared workspace VM of note 11 if the per-session clone ever hurts.

## Sources

- The session itself: `/proc/uptime`, `dmesg`, the process tree, the
  proxy status endpoint and `/root/.ccr/README.md`, read 2026-09-22.
- Claude Code in the cloud: <https://code.claude.com/docs/en/claude-code-on-the-web>;
  cloud environments: <https://code.claude.com/docs/en/cloud-environments>;
  Anthropic, "Claude Code sandboxing" (2025-10-20): <https://www.anthropic.com/engineering/claude-code-sandboxing>;
  "How we contain Claude" (2026-05-25): <https://www.anthropic.com/engineering/how-we-contain-claude>;
  a third-party look at the sandbox (2025-11-29): <https://michaellivs.com/blog/sandboxed-execution-environment/>
- Firecracker: releases <https://github.com/firecracker-microvm/firecracker/releases/latest>,
  specification <https://github.com/firecracker-microvm/firecracker/blob/main/SPECIFICATION.md>,
  rootfs and kernel <https://github.com/firecracker-microvm/firecracker/blob/main/docs/rootfs-and-kernel-setup.md>,
  snapshots <https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md>,
  vsock <https://github.com/firecracker-microvm/firecracker/blob/main/docs/vsock.md>,
  jailer <https://github.com/firecracker-microvm/firecracker/blob/main/docs/jailer.md>,
  production host setup <https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md>,
  ballooning <https://github.com/firecracker-microvm/firecracker/blob/main/docs/ballooning.md>,
  block device patch <https://github.com/firecracker-microvm/firecracker/blob/main/docs/api_requests/patch-block.md>,
  kernel policy <https://github.com/firecracker-microvm/firecracker/blob/main/docs/kernel-policy.md>,
  changelog <https://github.com/firecracker-microvm/firecracker/blob/main/CHANGELOG.md>
- ext4 "mounting unchecked fs": `fs/ext4/super.c`, `ext4_setup_super` <https://raw.githubusercontent.com/torvalds/linux/master/fs/ext4/super.c>
- Boot and CoW numbers: Depot (2026-04) <https://depot.dev/blog/optimizing-microvm-boot-times>,
  PandaStack (2026-06) <https://www.pandastack.ai/blog/how-firecracker-boots-fast/> and <https://www.pandastack.ai/blog/copy-on-write-rootfs/>,
  Actuated (2023) <https://actuated.com/blog/managing-github-actions>,
  e2b overlayfs (2025-02) <https://e2b.dev/blog/scaling-firecracker-using-overlayfs-to-save-disk-space>,
  e2b persistence <https://docs.e2b.dev/sandbox/persistence>,
  Northflank (2025-07) <https://northflank.com/blog/how-to-spin-up-a-secure-code-sandbox-and-microvm-in-seconds-with-northflank-firecracker-gvisor-kata-clh>,
  fly Machines <https://fly.io/docs/reference/machines/> and suspend <https://fly.io/docs/reference/suspend-resume/>,
  Lambda snapshots <https://docs.aws.amazon.com/lambda/latest/dg/microvms-images-snapshots.html>
- vsock and proxies: `mdlayher/vsock` <https://pkg.go.dev/github.com/mdlayher/vsock>,
  `firecracker-go-sdk` <https://github.com/firecracker-microvm/firecracker-go-sdk/commits/main>,
  `gvisor-tap-vsock` <https://github.com/containers/gvisor-tap-vsock>,
  a no-NIC Firecracker sandbox (2026-09-20) <https://github.com/presmihaylov/shard/pull/181>,
  a TLS-terminating credential-injecting proxy <https://github.com/by77er/iso>
- Hosts: AWS nested virtualisation (2026-02-16) <https://aws.amazon.com/about-aws/whats-new/2026/02/amazon-ec2-nested-virtualization-on-virtual>
  and <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/amazon-ec2-nested-virtualization.html>;
  Oracle, Firecracker on OCI VM vs BM (2026-01-15) <https://blogs.oracle.com/cloud-infrastructure/firecracker-oci-vm-vs-bm>
  and nested KVM (2025-04-18) <https://blogs.oracle.com/linux/kvm-nested-virtualization-in-oci>;
  Alibaba bare metal <https://www.alibabacloud.com/help/en/ecs/user-guide/elastic-bare-metal-server-overview>;
  Hetzner Cloud FAQ <https://docs.hetzner.com/cloud/servers/faq/>,
  Hetzner price adjustment 2026-06-15 <https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/>,
  Hetzner auction tracker <https://radar.iodev.org/>;
  GCP nested virtualisation <https://docs.cloud.google.com/compute/docs/instances/nested-virtualization/overview>;
  Azure Dv5 <https://learn.microsoft.com/en-us/azure/virtual-machines/sizes/general-purpose/dv5-series>;
  Latitude.sh <https://www.latitude.sh/pricing>;
  EC2 boot times <https://depot.dev/blog/faster-ec2-boot-time>
