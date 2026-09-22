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

### If switching hosts

| Host | Cores / threads | RAM | Disk | Running 4 vCPU sessions | Suspend wake | Price, approx. |
|------|-----------------|-----|------|-------------------------|--------------|----------------|
| i7-6700 auction box (current) | 4 / 8 | 64 GB | 2 × 512 GB SATA | 2 | ~15 s | €63 |
| AX42 (Ryzen 7 PRO 8700GE) | 8 / 16 | 64 GB | 2 × 512 GB NVMe | 4, or 6 with light overcommit | ~3 s | €47 to €57 plus setup |
| AX52 (Ryzen 7 7700) | 8 / 16 | 64 GB, DDR5 | 2 × 1 TB NVMe | 4 to 6 | ~2 s | ~€64 plus setup |

Recommendation: **build the MVP on the machine you have**, because it is
already installed and hardened and the two-VM cap matches its CPU. The
moment the demo scene works, move to an AX42 or AX52 class host: two to
three times the running slots, NVMe turns suspend into seconds, and the
same monthly money or less. The runner is a fresh install on the new
box; account volumes and hibernated overlays copy across as files. If
the auction box is not ordered yet, skip it and start on the AX42.

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

## 6. The same tiers on cloud machines

A session can run on a cloud machine instead of the host: an ordinary
runner, installed by cloud-init with an ordinary pairing token, on a VM
the control plane created through a machine-lifecycle port (note 14;
`versions/mvp/03` §Cloud machines). No guest agent, no vsock, nothing
of ours resident on any provider host. The session lifecycle is the one
above; what changes per provider is which tiers exist and what each
costs, and that is the whole story of cloud sessions. The drivers, in
the order they are built: **AWS, then Oracle Cloud, then Alibaba
Cloud** (v0.2). GCP, Azure, Fly Machines and Hetzner Cloud are further
drivers of the same port, unscheduled; their rows below say what each
would be.

| Provider | Suspend (RAM kept) | Pause (disk kept) | Cost while asleep | Notes |
|---|---|---|---|---|
| **AWS EC2** (first) | native hibernation: RAM to the encrypted root volume, resume restores processes | stop, EBS stays | EBS only; our shape about $5 a month, plus $3.60 if a public IP stays | hibernation needs an encrypted root sized root + RAM, a supported family, Amazon Linux 2023 or Ubuntu 22.04 (not 24.04), enabled at launch; 60-day cap |
| **Oracle Cloud** (second) | none | stop; the boot volume stays | boot volume only, 50 GB about $2 a month | stopped compute is free on Standard and Flex shapes; an OS shutdown does not stop billing, only the API stop does; stopped machines count against limits |
| **Alibaba Cloud** (third) | none in practice | stop in economical mode; disks stay | disks only, about $5 a month | the doc says a stopped instance may not restart when the zone has no inventory, so a pause pushes first and a refused start is a recreate |
| GCP | native suspend | stop | disk plus the suspended memory | unscheduled |
| Azure | hibernation | deallocate | disk | unscheduled |
| Fly Machines | none | stop, the volume stays | cents | unscheduled; Docker in a machine is not a supported path |
| Hetzner Cloud | none | a stopped server is billed in full; snapshot and delete instead | snapshot storage | unscheduled; the wrong product for sessions (§7) |

What the port does per tier: **pause** is `stop('suspend')` where the
driver has suspend and `stop('stop')` elsewhere — the policy reads the
capability and sends the verb it means, and a driver without suspend
refuses the word rather than degrading it; **resume** is `start`, then
the same token rotation and clock check as on our host, and on a
driver without suspend the runner relaunches tmux and resumes the
agent by its session id, the hibernate column of §1; **delete** is
`destroy`, volumes gone except the account volume.

Two things stay the same everywhere: the runner dials **out** to the
control plane over TLS with the host identity pairing gave it; and the
account volume is a provider volume attached to one instance at a
time, exactly the F13 rule.

Cost reality for a hosted plan, per always-available session slot:

| Where | Running, per hour | Asleep, per month | Wake |
|-------|-------------------|-------------------|------|
| Own AX42-class host | ~€0.01 amortised over six slots | ~€0 (disk we already own) | seconds |
| AWS t4g.xlarge, 4 vCPU 16 GB, Frankfurt | $0.154 on demand, $0.072 spot | ~$5 to $9 | tens of seconds, hibernate resume |
| Oracle A1.Flex, 4 OCPU 16 GB | $0.064 | ~$2 | a boot plus an agent resume, about two minutes |
| Alibaba g7a.xlarge, 4 vCPU 16 GB, Frankfurt | $0.196 on demand, $0.043 spot | ~$5 | a boot plus an agent resume, if it restarts |

So the pricing shape in §5 gets one more line: **cloud sessions bill
per running hour plus storage while asleep, at the provider's price
plus a margin**, and the console shows the meter. The user picks where
a host lives when they add it: their own machine, or a cloud account
they connect. AWS first, because it has real hibernation and the
largest audience; Oracle second, because it is the cheapest to run by
a factor of two and its trial is a 30-day clock; Alibaba when a user
brings an account.

## 7. Own host versus cloud versus sandbox services, for this workload

Corrected numbers after the June 2026 Hetzner repricing (the CPX31
figures earlier in this note were pre-repricing): Hetzner Cloud CPX32,
4 vCPU / 8 GB / 160 GB NVMe, is €35.99 a month or €0.0577 an hour, and
a stopped Hetzner cloud server is still billed.

The workload to price is a personal workspace: **two sessions running
about six hours a day, ten more asleep**, every session needing a real
Linux VM with Docker inside and a lifetime of days.

| Option | Shape | Running cost | Asleep cost | Fits the workload? | Rough monthly |
|--------|-------|--------------|-------------|--------------------|---------------|
| **Own dedicated host, AX42 class** | 8 cores, 64 GB, NVMe | flat | free | yes: Docker inside, days-long, sleep tiers, 4 to 6 running | **€47 to €57** |
| Own auction host, i7-6700 | 4 cores, 64 GB, SATA | flat | free | yes, but only 2 running and slow suspend | €63 |
| Hetzner Cloud CPX32 per session | 4 vCPU, 8 GB | €0.0577 / h | **full price while stopped** | no sleep economics: 12 sessions would be €432; only 2 always-on ones is €72 and nothing sleeps | €72 for 2, no sleeping sessions |
| AWS EC2 t3a.xlarge per session | 4 vCPU, 16 GB | ~$0.15 / h on demand | EBS only, ~$0.08 per GB-month | yes: native hibernation, Docker inside, days-long; pay only while running | ~$55 compute + ~$30 EBS for 12 volumes ≈ **$85** |
| Fly Machines per session | 4 shared vCPU, 8 GB | ~$0.10 / h | rootfs cents, volumes ~$0.15 per GB-month | mostly: stop and start in seconds, but no memory suspend and Docker-in-machine is not a supported path | ~$36 compute + ~$54 volumes ≈ $90 |
| E2B sandboxes | Firecracker microVM, per vCPU and GiB | $0.0504 per vCPU-hour + $0.0162 per GiB-hour, so ~$0.33 / h at 4 vCPU 8 GB | pause keeps memory and filesystem; snapshot storage billed | partly: pause and resume is excellent, but no Docker daemon inside a sandbox, and the Pro tier has a $150 floor | **$150 minimum**, ~$119 of usage inside it |
| Vercel Sandbox | Firecracker microVM, 2 to 32 vCPU | $0.128 per active vCPU-hour | n/a | **no**: maximum lifetime 45 minutes on Hobby and 5 hours on Pro; built for short agent runs, not days-long terminals | not applicable |

What the table says:

- **A dedicated host is the cheapest by a wide margin and the only
  option where sleeping is free.** That is the whole reason the runner
  host exists, and an AX42 is the right one. The i7 works but is worse
  value than the AX42 it is being compared to.
- **Hetzner Cloud is the wrong product for sessions** because it bills
  stopped servers. It is fine for the control plane, which is always
  on and small (a CPX22 at €19.99 is plenty).
- **AWS is the right cloud adapter for later**, because EC2 hibernation
  gives real suspend and you pay only while running. It costs more than
  the dedicated host for a personal workspace, but it scales to zero and
  to many, which the host cannot.
- **E2B and Vercel Sandbox are sandbox APIs for short agent code runs.**
  They are not the shape of this product: no Docker inside, lifetime
  caps, and a pricing floor. E2B's pause and resume is a good reference
  for what we build on libvirt, not a place to run it.

## 8. What a task actually costs, and whether VMs are worth it

A typical agent task, say one hour of Codex working on a repo, spends
most of that hour waiting on the model. CPU is busy maybe 10 to 30 % of
the time, for installs, builds, and tests. So the compute bill for one
hour-long task is:

| Where | Compute for a one-hour task | The model for the same task |
|-------|-----------------------------|-----------------------------|
| Own AX42 host, amortised over ~150 task-hours a month | about €0.01 to €0.03 | €2 to €20 on API pricing, or part of a subscription |
| AWS t3a.xlarge | about $0.15 | same |
| E2B | about $0.33 | same |

Compute is one to five percent of what a task costs. It is never the
reason to change the architecture. The reasons to pick VMs or
containers are isolation, density, and what the agent can do inside.

| | VM per session (KVM) | Container per session (Docker on the host) |
|---|---|---|
| Isolation | hardware boundary; an escape stays in the guest | kernel shared with the host and every other session; an escape is the host |
| Docker inside | yes, a real daemon | needs privileged mode or a sysbox-style runtime; the usual pain |
| Memory per idle session | the guest kernel plus whatever is used; with the balloon driver and free-page reporting the host reclaims unused pages, so an idle guest costs far less than its 8 GB ceiling | tens of MB |
| Start | tens of seconds from cloud-init, seconds from a saved image | under a second |
| Sleep | pause in RAM, managedsave to disk, hibernate: all mature | cgroup freeze is instant; checkpoint to disk (CRIU) is fragile |
| Density on the i7 host | 2 running by the strict 4 vCPU rule; 4 with 2:1 CPU overcommit, since agents mostly wait | 8 to 10 |
| Multi-tenant later | yes | no, not with agents running with permissions bypassed |

Decision: **keep VMs**, for three reasons that have nothing to do with
compute cost. The hardened pipeline already exists. Docker inside works
without tricks. And the day a second person uses the product, VMs are
the only acceptable boundary between two people's agents running with
permissions bypassed.

Two adjustments that recover most of the density argument:

- **Overcommit CPU 2:1.** Agent sessions are idle most of the time, so
  the running cap is set by measured host load, not by counting 4 vCPU
  per VM. On the i7 host that means about four running sessions instead
  of two; on an AX42, eight to twelve.
- **Let the balloon reclaim memory.** With `virtio-balloon` and free
  page reporting in the image, an idle 8 GB guest gives back most of its
  RAM to the host, so paused-in-RAM sessions are cheaper than the earlier
  "8 GB each" arithmetic assumed.

Neither changes the two-VM cap in the existing CI controller, which
sizes for CPU-hungry build jobs. Sessions get their own cap.

## 9. Fifty agents running at once

Assumptions: the 4 vCPU / 8 GB session shape, agents busy 10 to 30 % of
the time so 2.5:1 CPU overcommit holds, balloon reclaim keeps average
guest memory near 3 to 4 GB, and "running" means eight hours a day, 22
days a month, 8,800 agent-hours.

| Where | How | Compute per month |
|-------|-----|-------------------|
| Own dedicated hosts, AX42 class | 5 hosts: 80 threads for 200 vCPU at 2.5:1, 320 GB RAM | **€250 to €300** flat, whether 8 or 24 hours a day |
| Own dedicated hosts, AX102 class (16 cores, 128 GB) | 3 hosts | ~€350 flat, fewer boxes to run |
| AWS t3a.xlarge on demand | 8,800 h × $0.15 | ~$1,300, plus ~$150 EBS; ~$5,400 if 24/7 |
| AWS spot | 8,800 h × ~$0.05 | ~$450, with interruptions to handle |
| Hetzner Cloud CPX32 | 50 × €36, billed whether running or stopped | €1,800 |
| E2B | 8,800 h × $0.33 | ~$2,900 |

And the number that dwarfs all of them: **the model.** 8,800 agent-hours
at even $2 to $5 an hour of API usage is $18,000 to $44,000 a month.
Subscriptions cap the bill but also cap the rate: one Codex or Claude
Max seat cannot drive fifty concurrent agents, and fifty seats is
$10,000 a month. At fifty agents the question is never the VMs; it is
who pays for the tokens and how many accounts are legitimately yours.

For a personal workspace, the honest ceiling is the number of agents one
person's subscriptions can drive at once, which is a handful, and a
single AX42 covers that with room to spare.

## 10. Ephemeral sessions, and the realistic scale

Realistic scale for a personal workspace: **at most about ten sessions
running at once**, usually two or three, many more asleep. One AX42
with 2:1 overcommit handles ten. The cloud is for the days you exceed
that, or for when the host is down.

To keep cloud cost honest, a session carries a **lifetime** chosen at
creation, next to host, repo, branch, and agent:

| Lifetime | Behavior | Cost while not running | Use it for |
|----------|----------|------------------------|------------|
| **Keep** (the default everywhere) | the three sleep tiers, destroyed only when you close it | free on your host; storage on a cloud | long-running work you return to for days |
| **Ephemeral** (an option) | runs, sleeps briefly, and is **destroyed after N hours idle** (default 2 h). The agent is told at start that the VM is disposable, so it pushes its branch; the runner also auto-pushes the working branch before destroying, and keeps the last scrollback in the session log | nothing: no volume, no memory image, no instance | one task, one PR, done |

What "ephemeral" keeps: the pushed branch on GitHub, the session log
and scrollback in the control plane, and the account volume (that is
per account, not per session). What it drops: the VM, its overlay, and
anything not pushed. The sidebar shows an ephemeral session with a
timer instead of a moon.

On AWS an ephemeral session is pure running-hours: ten sessions,
four hours each on a working day, 22 days, is 880 hours, about **$130 a
month on demand or $45 on spot**, and $0 on the days you do not use it.
On your own host the same sessions are free either way. Keep is the
default on a cloud host too (v0.2, note 14 §7): a paused machine costs
only its disk on AWS, Oracle and Alibaba, so the session pauses after
thirty idle minutes, resumes when opened, and is deleted when you say
so or after seven days asleep. Ephemeral is the option for one-task
work.

Placement follows the same logic: the **host chip** lists your own
hosts and any connected cloud accounts. Own host first; cloud when the
host is full, marked with its per-hour price on the chip so the choice
is visible.

## 11. What this changes in the plan

- Note 07's lifetime decision becomes the three-tier policy above:
  pause in RAM, then suspend to disk, then hibernate.
- Step 2 of the MVP order gains hibernate-and-resume by agent session
  id, next to `managedsave`.
- Note 08's "two-VM cap" stays for CI jobs. Sessions get their own cap
  set by measured load with 2:1 CPU overcommit: about four running on
  the i7-6700 host, eight to twelve on an AX42. The paused tier plus
  balloon reclaim is what lets many more sessions stay warm.
- The cloud port gets an order: AWS, Oracle, Alibaba (note 14). It is
  v0.2, the slice after the MVP; the MVP host is the Hetzner machine.

## Sources

- libvirt save and restore, managedsave semantics and the "disk must be
  unchanged" rule: Red Hat virtualization docs,
  <https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_virtualization/saving-and-restoring-virtual-machines_configuring-and-managing-virtualization>
- Hetzner AX42: <https://www.hetzner.com/dedicated-rootserver/ax42/>,
  price adjustment 15 June 2026:
  <https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/>
- Hetzner Cloud prices after June 2026 (CPX32 €35.99, screenshot of the live console): <https://www.hetzner.com/cloud/>
- Vercel Sandbox pricing and limits: <https://vercel.com/docs/sandbox/pricing>, <https://vercel.com/docs/limits>
- E2B pricing: <https://www.morphllm.com/e2b-pricing>, <https://bex.co/blog/2026/09/10/e2b-firecracker-sandbox-pricing-vs-owning-fleet>
- AWS t3a.xlarge pricing: <https://instances.vantage.sh/aws/ec2/t3a.xlarge>
- Hetzner cloud pricing 2026: <https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/>,
  <https://northflank.com/blog/hetzner-cloud-server-price-increases>
- AWS EC2 hibernation prerequisites and behavior: AWS docs, "Hibernate your Amazon EC2 instance".
- GCP suspend and resume: Google Cloud docs, "Suspend and resume an instance".
- Fly Machines stop and start billing: Fly.io docs, "Machines" and pricing.
- Hetzner Cloud billing of stopped servers: Hetzner Cloud docs, billing FAQ.
- Claude Code on the web, environment expiry and restore:
  <https://code.claude.com/docs/en/claude-code-on-the-web>
