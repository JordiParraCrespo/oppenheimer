# 08 — Reusing the GitHub Actions runner host for sessions

Input from discussion: there is already a Go codebase that runs
ephemeral, self-hosted GitHub Actions runners on a dedicated Hetzner
host (`gha-runner-01`). Every queued job gets a fresh Ubuntu KVM guest
that is destroyed when the job ends. The host has no public services;
administration is SSH over Tailscale. The website and the runners must
live in different places.

That codebase is most of note 03's provisioner, already built and
already hardened. This note records what it gives us, what a session
needs on top of a CI job, and what changes in the plan.

## 1. What the existing controller already does

Mapped against note 03 §4 and note 04:

| Existing behavior | Where it lands in our design |
|-------------------|------------------------------|
| Fresh KVM guest per job, destroyed at the end | VM per session (mode B) |
| Golden Ubuntu image built from a GPG-verified cloud image, per-VM qcow2 overlay | base image + copy-on-write overlay per task |
| 4 vCPU, 8 GiB RAM, 60 GiB overlay, host capped at two VMs by a shared gate | the session budget and the per-host capacity gate |
| JIT runner configuration for one ephemeral runner and one job | the JIT guest identity in note 03 §2 |
| GitHub App, never a personal token; `Administration` only on selected repos | note 02's GitHub App and per-session installation tokens |
| VMs receive no host mounts, credentials, Docker socket, or libvirt socket | F16, F19 |
| Docker inside the guest, nested virtualization disabled | the same |
| Guest-to-host traffic denied except DHCP and DNS | the basis for F14's "only route is the host" |
| Serial console logs kept on the host, pruned after 30 days | provisioning logs in the session event log |
| Controller start removes stale scale sets and orphaned `gha-vm-` domains | the runner's reconcile-on-boot |
| Host verify script, health timer, systemd unit, Tailscale-only admin | the runner install and the Tailscale perimeter from note 04 §4 |
| Pinned and checksummed components | F28 |

Nearly every security finding that mode B needed is already true on
that host. The work is not "build a provisioner", it is "teach the
existing one about sessions".

## 2. What a session needs that a CI job does not

| Need | Why | How, on the existing stack |
|------|-----|----------------------------|
| **A PTY into the guest, streamed to the browser** | the whole product | A guest agent baked into the golden image (the `guest` subcommand from note 03 §5) that connects to the host over **virtio-vsock**, which libvirt supports, and carries PTY bytes, resize, and status. No network hole is opened; the "guest-to-host denied except DHCP and DNS" rule stays. |
| **Long-lived, interactive, pause and resume** | sessions last days, jobs last minutes | kill the VM on idle and keep its disk; a wake boots a fresh VM on that disk in about two seconds and the agent resumes by its own session id (note 15). Delete drops the disk. |
| **Persistent account volumes** | vendor logins must survive across VMs (notes 04 F13, 06) | One extra raw disk per account, attached to the VM whose session selected it, one attachment at a time, `/home/agent/.codex` mounted from it. |
| **Repo clone at a chosen branch with a scoped token** | the repo and branch chips | Mint a one-hour repo-scoped installation token per session, exactly as the JIT runner config is minted today, and deliver it through the same cloud-init seed to a git credential helper in the guest. The host-side egress proxy from note 02 (token never in the guest) is the next slice; the seed path is what the runner already does for its own credential and is acceptable for a personal workspace. |
| **Agent and terminal in the image** | Codex first | Add `tmux`, the Codex CLI, and the guest agent to the golden image; a new image revision, same build script. |
| **Screen-manifest state for the sidebar dot** | working / blocked / idle | The guest agent classifies the pane and reports over vsock; the host runner forwards it in the heartbeat. |
| **Outbound link to a control plane elsewhere** | website and runners in different spots | The host runner dials out over the tailnet to the hosted control plane (see §3). Today the controller only talks to GitHub. |

## 3. Website and runners in different spots

Three places, two links:

```
browser ── public HTTPS ──► control plane (hosted: web, API, relay, Postgres)
                                   ▲
                                   │ tailnet, outbound from the host
gha-runner-01 (Hetzner) ── runner ─┘
   └── libvirt ── KVM guests ── vsock ── guest agent
```

- **Control plane**: hosted by us, public HTTPS for browsers, GitHub
  OAuth sign-in. It also joins the tailnet as a node (tsnet, note 04 §4),
  so the runner link never crosses the public internet and the host
  keeps its "no public services" property.
- **Runner**: on the Hetzner host, dials out to the control plane's
  tailnet address, authenticated with the registration token and keypair
  from note 03 §2 on top of Tailscale's node identity. Belt and braces.
- **Guests**: not on the tailnet, not reachable from anywhere. Only the
  vsock channel to the host and NAT egress through the host.

This is the same three-tier picture as note 00, with Tailscale filling
the runner link because the host already has it.

## 4. Decision: Firecracker first, and what that leaves of the controller

This section first said libvirt/KVM first and Firecracker later,
because the existing host ran libvirt guests and reuse won on boot
time being "the price" of a session that starts once and lives for
days. Note 15 (2026-09-22) reverses it: a session is a Firecracker
microVM that exists only while active, on a kept disk, and **the boot
time is the product** — a wake is a boot, so tens of seconds per wake
is not acceptable and libvirt's `managedsave` is what the sleep tiers
existed to use. What survives from the controller is the ideas:
golden image built and verified in CI, a capacity gate counting
running guests, reconcile-on-start, no host mounts or sockets in a
guest. What does not: qcow2 overlays (Firecracker takes raw images),
cloud-init guests (the guest agent is `init`), the two-VM cap sized
for build jobs (sessions get their own, note 10 §8), and the
`managedsave` tiers (two states, note 15 §2).

The CI controller keeps running its own guests beside the session
runner; they never share a domain prefix or an image.

## 5. Where the code lives

Keep the GitHub Actions controller as it is. Add the session runner as a
second binary in the same Go module, sharing the packages that are not
CI-specific:

| Existing package (by responsibility) | Reused by the session runner |
|--------------------------------------|------------------------------|
| libvirt domain lifecycle, overlay and seed creation, console log capture | no: sessions are Firecracker microVMs driven over their socket, raw reflinked disks, no seed (note 15; §4) |
| golden image build script | as a pattern: the session image is a Dockerfile exported to a signed raw ext4 (`versions/mvp/04`) |
| capacity gate | as a pattern, counting running microVMs with the session cap of note 10 §8 |
| GitHub App auth and token minting | yes, minting repo-scoped installation tokens instead of runner JIT configs |
| scale set client and job handling | no, that is CI-only |
| reconcile-on-start of stale domains | as a pattern, over VM sockets and session disks |

New packages: the microVM runtime and the guest agent
(`versions/mvp/02` §14), the host-side egress proxy, and account volume
management later. The link to the control plane is the MVP runner's.
The Go choice from note 03 is confirmed by the existing code.

## 6. What changes in the MVP order (note 07)

| Step | Was | Now |
|------|-----|-----|
| 1 | Runner on the host, tmux terminal in the browser | Same, but the runner is the new binary in the existing module, and it dials out over the tailnet to a hosted control plane from day one |
| 2 | Boot a Firecracker VM, terminal inside | Boot a libvirt guest from a new golden image revision, guest agent over vsock, `managedsave` on idle, destroy on close |
| 4 | GitHub App, token minting, egress proxy, clone | GitHub App and token minting reuse the existing code; deliver the token by seed; egress proxy moves to the next slice |
| 5 | Account volumes | Same, as extra qcow2 disks |

Net effect: step 2 shrinks from two weeks to about one, step 4 from two
weeks to about one. The remaining risk is the vsock PTY bridge and the
guest agent, which is new code.

## 7. What I still need to map precisely

A look at the actual repository, so the package table above names real
packages and the guest agent can be planned against the real image build.
