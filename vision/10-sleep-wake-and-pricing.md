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

## 2. The policy: two tiers, like a laptop

```
running ──(idle 10 min)──► suspended ──(asleep 24 h)──► hibernated ──(close)──► destroyed
   ▲                           │                             │
   └──── wake, seconds ────────┘                             │
   └──── wake, tens of seconds ──────────────────────────────┘
```

- **Idle ten minutes**: no terminal input, no output, no agent activity
  from the screen manifest. Suspend. The sidebar dot turns grey with a
  moon. Memory image on the host, RAM freed, VM cap freed.
- **Asleep 24 hours**: hibernate. Drop the memory image, keep the disks.
  The agent's session id was recorded when it went idle, so wake can
  resume it.
- **Wake**: opening the session, or sending input, wakes it. From suspend
  the terminal is live in a few seconds with the cursor where it was.
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

## 4. What a host holds

Using the AX42 class host as the reference (8 cores, 64 GB RAM, two
512 GB NVMe, roughly €47 to €57 a month depending on when it was ordered;
Hetzner repriced dedicated servers on 15 June 2026, so check the live
page):

| Resource | Per session | Host holds |
|----------|-------------|-----------|
| Running VM | 4 vCPU, 8 GB | 6 concurrently, keeping 16 GB and two cores for the host |
| Suspended session | up to 8 GB memory image + overlay | disk-bound |
| Hibernated session | overlay only, thin, typically 5 to 15 GB used | disk-bound |
| Disk | | ~900 GB usable: for example 20 suspended (160 GB) plus 50 hibernated (500 GB) plus images |

The existing cap of two VMs is a policy number, not a hardware one; on
this host it can rise to six. Cloud comparison: one always-on 4 vCPU,
8 GB Hetzner cloud VM (CPX31 class) is €16 to €25 a month, so six of
them cost two to three times the dedicated host, with no sleep and no
shared disk. A dedicated host with sleep is the cheap option, which is
why the runner host exists.

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

## 6. What this changes in the plan

- Note 07's lifetime decision becomes the two-tier policy above, with
  suspend as the first tier and hibernate as the second.
- Step 2 of the MVP order gains hibernate-and-resume by agent session
  id, next to `managedsave`.
- Note 08's "two-VM cap" is a configurable per-host limit; the default
  for an AX42-class host is six.

## Sources

- libvirt save and restore, managedsave semantics and the "disk must be
  unchanged" rule: Red Hat virtualization docs,
  <https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_virtualization/saving-and-restoring-virtual-machines_configuring-and-managing-virtualization>
- Hetzner AX42: <https://www.hetzner.com/dedicated-rootserver/ax42/>,
  price adjustment 15 June 2026:
  <https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/>
- Hetzner cloud pricing 2026: <https://www.bitdoze.com/hetzner-cloud-cost-optimized-plans/>,
  <https://northflank.com/blog/hetzner-cloud-server-price-increases>
- Claude Code on the web, environment expiry and restore:
  <https://code.claude.com/docs/en/claude-code-on-the-web>
