# 10 — Sleep, wake, and what it costs

Question: can sessions sleep when idle and wake when you come back, the
way a Claude Code on the web session "expires" and comes back when you
reopen it? Yes, and on a KVM host it can be better than that, because we
can choose between two kinds of sleep.

## 1. Two kinds of sleep

| | Suspend | Hibernate |
|---|---|---|
| libvirt primitive | `managedsave`: guest memory is written to a file on the host, the VM stops | `destroy` the VM, keep its disks (overlay and account volume) |
| What survives | everything: running processes, the agent mid-task, tmux, scrollback, open files | the disk: repo working tree, uncommitted changes, agent session files, account login |
| What is lost | nothing | running processes; the agent must be resumed by its native session id (`codex resume`, `claude --resume`), tmux is relaunched, scrollback comes from the runner's log |
| Cost while asleep | disk for the memory image, up to the VM's RAM (8 GB) | disk for the overlay only |
| Wake time | a few seconds: read the memory image from NVMe and continue | a fresh boot from the existing overlay, tens of seconds, cloud-init already done so faster than first boot |
| Same as | closing a laptop lid | Claude Code on the web's "environment expired, reopen to restore" |

Claude Code on the web only has the second kind. It restores the
conversation onto a fresh VM and tells you that background work is gone.
We have both, because the host is ours.

## 2. The policy: three tiers, tuned to the actual host

The MVP host is a Hetzner auction box: Intel Core i7-6700 (4 cores, 8
threads), 64 GB RAM, two 512 GB SATA SSDs, about €63 a month. That
shape is RAM-rich and CPU-poor, and its SSDs are SATA, so writing an
8 GB memory image takes around fifteen seconds rather than a few. The
tiers use RAM first, disk second:

```
running ──(idle 10 min)──► paused ──(idle 2 h)──► suspended ──(asleep 24 h)──► hibernated ──(close)──► destroyed
   ▲                          │                       │                            │
   └──── wake, instant ───────┘                       │                            │
   └──── wake, ~15 s ─────────────────────────────────┘                            │
   └──── wake, tens of seconds ────────────────────────────────────────────────────┘
```

- **Idle ten minutes**: no terminal input, no output, no agent activity
  from the screen manifest. **Pause** (`virsh suspend`): the VM keeps its
  RAM but uses no CPU. Wake is instant. The sidebar dot turns grey with
  a moon. A paused VM frees a running slot, since slots are CPU-bound on
  this host, but not its 8 GB.
- **Idle two hours**: **suspend** (`managedsave`): memory to disk, RAM
  freed. Wake is about fifteen seconds on SATA.
- **Asleep 24 hours**: **hibernate**. Drop the memory image, keep the
  disks. The agent's session id was recorded when it went idle, so wake
  can resume it.
- **Wake**: opening the session, or sending input, wakes it. From pause
  it is instant; from suspend the terminal is live in about fifteen
  seconds with the cursor where it was.
  From hibernate the guest boots, tmux starts, the agent is relaunched
  with `resume`, and the terminal shows the tail of the old scrollback
  above the new prompt.
- **Close**: destroy the VM and the overlay. The account volume stays.

Timeouts are per-user settings with those defaults.

## 3. What makes it work, and what to watch

- **Disk must not change while suspended.** libvirt restores memory
  assuming the disks are exactly as they were. The runner never touches
  a suspended VM's overlay; account volumes stay attached and locked.
- **Tokens expire while asleep.** The one-hour repo token will be dead
  after any real sleep. On wake the runner mints a fresh one and rotates
  it into the guest over vsock before it announces "ready" (note 09 §4).
- **The guest clock jumps** after a long suspend. `chrony` in the image
  corrects it on resume; without that, TLS and git timestamps misbehave.
- **Agent session ids** are captured continuously, not at sleep time, so
  a crash-hibernate can still resume.
- **Memory image size.** A suspended 8 GB VM writes up to 8 GB. On NVMe
  that is a few seconds each way. Compression is optional in libvirt and
  not worth it on NVMe.
- **Two-VM cap counts running VMs only.** Suspended and hibernated
  sessions cost disk, not slots. Thirty sleeping sessions and two running
  ones is a normal day.

All of it is libvirt and the runner; nothing new to invent.

## 4. What this host holds

| Resource | Per session | The i7-6700 / 64 GB host holds |
|----------|-------------|-------------------------------|
| Running VM | 4 vCPU, 8 GB | **2** at once: 8 threads on the host, 4 per VM, and the existing cap of two is exactly right. Three at 2 vCPU each is possible if we lower the VM size. |
| Paused VM (RAM kept, no CPU) | 8 GB | **up to 5 more** beside the two running ones: 7 × 8 = 56 GB, leaving 8 GB for the host. This is the tier that makes the box feel big. |
| Suspended session | 8 GB memory image on disk + overlay | disk-bound, ~15 s to wake on SATA |
| Hibernated session | overlay only, thin, typically 5 to 15 GB used | disk-bound |
| Disk | | 1 TB raw. If the two SSDs are mirrored, ~470 GB usable: for example 10 suspended (80 GB) plus 25 hibernated (250 GB) plus images. Unmirrored doubles that at the cost of safety; mirror it, sessions are user data. |

So on this host the honest numbers are: two working, five more ready
to resume instantly, ten more resumable in fifteen seconds, dozens more
resumable in under a minute. The CPU, not the RAM, is the limit, and a
newer AX-class host with 8 cores would double the running slots for a
similar price (AX42 class, 8 cores, 64 GB, NVMe, roughly €47 to €57 a
month after the June 2026 repricing).

Cloud comparison: one always-on 4 vCPU, 8 GB Hetzner cloud VM (CPX31
class) is €16 to €25 a month, so even two of them with no sleep cost
most of this host, which sleeps for free.

## 5. Pricing model for the product

Compute is the user's own host in the MVP, so the product charges for the
control plane, not for VMs.

| Plan | What it is | Price shape |
|------|------------|-------------|
| Personal, bring your host | hosted console, one user, hosts you own, unlimited sessions within your host's capacity | flat monthly, in the range of a developer tool subscription |
| Hosted host, later | we run the host for you | price per host size, pass-through of the dedicated-server cost plus margin, or per running-VM-hour with sleeping sessions free |
| Team, much later | orgs, sharing, billing | out of scope |

The one rule worth fixing now: **sleeping sessions are free**. That is
what makes "open thirty sessions and forget them" feel safe, and it is
true on the cost side because they cost disk only.

## 6. The same two tiers on AWS and other clouds

The cloud adapter from note 03 §4 is the runner running in the control
plane instead of on a host, calling a provider API. The session
lifecycle stays identical; only what each state costs changes, and that
is the whole story of cloud sessions.

| Provider | Suspend (RAM kept) | Hibernate (disk kept) | Cost while asleep | Notes |
|----------|--------------------|-----------------------|-------------------|-------|
| **AWS EC2** | native hibernation: RAM written to the encrypted EBS root, instance stops, resume restores processes | stop the instance, EBS volumes stay | EBS only, roughly $0.08 per GB-month for gp3, so a 60 GB root plus an 8 GB memory image is about $5 a month; compute is zero | hibernation needs an encrypted root volume, a supported instance family (most current general-purpose ones), and RAM under the documented limit; both fit our 8 GB shape |
| **GCP Compute Engine** | native suspend and resume, memory to persistent disk | stop the instance | persistent disk plus the suspended memory storage | supported on most machine types, not on preemptible |
| **Azure** | hibernation, generally available | deallocate | disk only | needs a hibernation-enabled VM and page file sizing |
| **Fly Machines** | none | stop the machine, attached volume stays; start is seconds | rootfs storage only, roughly cents; volumes billed per GB-month | closest to our own host in feel: per-second billing, sub-second stops, fast starts |
| **Hetzner Cloud** | none | shut down, or snapshot and delete | a stopped Hetzner cloud server is billed the full price; only a snapshot plus delete stops the bill | so on Hetzner Cloud, hibernate means snapshot and delete, wake means create from snapshot, which is minutes, not seconds |

What the adapter does per state:

- **Suspend** → EC2 `StopInstances` with hibernate, GCP `suspend`, Azure
  hibernate. Where the provider has no suspend (Fly, Hetzner Cloud), the
  adapter skips this tier and goes straight to hibernate.
- **Hibernate** → stop or deallocate, keep the volumes; on Hetzner Cloud,
  snapshot then delete.
- **Wake** → start or resume, then the same token rotation and clock
  check as on our host.
- **Destroy** → terminate, delete volumes except the account volume,
  which is a provider block volume that lives on.

Two things stay the same everywhere: the guest agent, image, and vsock
contract do not exist on clouds, so the guest agent connects **out** to
the control plane over TLS instead, with the same JIT identity; and the
account volume is a provider volume attached to one instance at a time,
exactly the F13 rule.

Cost reality for a hosted plan, per always-available session slot:

| Where | Running, per hour | Asleep, per month | Wake from suspend |
|-------|-------------------|-------------------|-------------------|
| Own AX42-class host | ~€0.01 amortised over six slots | ~€0 (disk we already own) | seconds |
| EC2 t3.xlarge or similar, 4 vCPU 16 GB | ~$0.17 on demand | ~$5 EBS | tens of seconds (hibernate resume) |
| Fly Machine, 4 vCPU 8 GB | ~$0.10 | cents | seconds, but from a cold process state |
| Hetzner Cloud CPX31 | ~€0.03 | full price if merely stopped | minutes via snapshot |

So the pricing shape in §5 gets one more line: **cloud sessions bill per
running hour plus storage while asleep, at the provider's price plus a
margin**, and the console shows the meter. The user picks where a host
lives when they add it: their own machine, or a cloud account they
connect. AWS first, because it has real hibernation and the largest
audience; Fly second for its speed; GCP and Azure after.

## 7. What this changes in the plan

- Note 07's lifetime decision becomes the three-tier policy above:
  pause in RAM, then suspend to disk, then hibernate.
- Step 2 of the MVP order gains hibernate-and-resume by agent session
  id, next to `managedsave`.
- Note 08's "two-VM cap" is a configurable per-host limit. On the
  i7-6700 host two running is correct; the paused tier is what lets
  many more sessions stay warm.
- The cloud adapter of note 03 gets an order: AWS first, Fly second,
  GCP and Azure after. It is a post-MVP slice; the MVP host is the
  Hetzner machine.

## Sources

- libvirt save and restore, managedsave semantics and the "disk must be
  unchanged" rule: Red Hat virtualization docs,
  <https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_virtualization/saving-and-restoring-virtual-machines_configuring-and-managing-virtualization>
- Hetzner AX42: <https://www.hetzner.com/dedicated-rootserver/ax42/>,
  price adjustment 15 June 2026:
  <https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/>
- Hetzner cloud pricing 2026: <https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/>,
  <https://northflank.com/blog/hetzner-cloud-server-price-increases>
- AWS EC2 hibernation prerequisites and behavior: AWS docs, "Hibernate your Amazon EC2 instance".
- GCP suspend and resume: Google Cloud docs, "Suspend and resume an instance".
- Fly Machines stop and start billing: Fly.io docs, "Machines" and pricing.
- Hetzner Cloud billing of stopped servers: Hetzner Cloud docs, billing FAQ.
- Claude Code on the web, environment expiry and restore:
  <https://code.claude.com/docs/en/claude-code-on-the-web>
