# 14 — Ephemeral cloud machines: one interface, three providers

Question: can a session run on a machine that exists only for that
task, the way a Claude Code on the web session gets a fresh VM and
loses it when it goes idle, and can we drive that through one interface
on AWS, Oracle Cloud and Alibaba Cloud? Yes. The shape is smaller than
the cloud adapter notes 03 and 10 sketched, because the MVP runner
already does most of the work: a cloud machine is **a host that pairs
itself**, and the provider driver only creates, stops and destroys
machines. This is the research behind **v0.2**: what Claude Code on the web
does, each provider's facts as of 2026-09-22, the comparison, the
login gap, and the order of work — AWS first, Oracle second while the
$300 trial is live, Alibaba when somebody needs it. The decisions it
led to live in the MVP design notes that own them, not here: the port,
the routes and the pause, resume, delete policy in
[`versions/mvp/03`](versions/mvp/03-control-plane.md) §Cloud machines,
the tables in `versions/mvp/10`, the wire and the runner in
`versions/mvp/01` and `02`, the screens in `05`, the cloud-init path
in `09`.

Sources are primary docs and price lists, dated where the page gives a
date; the Claude Code self-hosted runner docs are read closely because
Anthropic solved exactly this problem for its own product this year.

## 1. What Claude Code on the web does, and what it does on your infra

Anthropic-hosted: every cloud session runs in an isolated VM Anthropic
manages, with the repository cloned, a saved *environment* (network
access level, variables, setup script), and a proxy that holds git
credentials outside the sandbox. After a period of inactivity the VM is
reclaimed; reopening the session provisions a fresh VM with the
conversation restored and background work gone. There is no separate
compute charge; the VM is inside the subscription.

Self-hosted (public beta on Team and Enterprise, 2026): the same
sessions execute on machines you run. Three parts, and the names are
worth keeping because they are ours with different labels:

| Theirs | Ours | What it is |
|--------|------|------------|
| Environment | a cloud account, or a host | a named destination sessions are routed to; groups runners |
| Runner (`claude self-hosted-runner`) | `oppenheimer-runner` | a process on your host that claims a session, clones, spawns the agent, streams events out; polls `api.anthropic.com`, nothing inbound |
| Session | session | one task |
| Environment secret, then a per-runner work order | the pairing token, then the host key | how a runner proves it may join |

The part that answers this note is their **orchestrator**: a stateless
process that polls for *spawn requests*, one per queued session with no
runner free, and runs a `spawn-runner` hook per request. The hook
"submits a workload to your platform: a Kubernetes Job, an EC2 instance,
a Nomad dispatch", asynchronously, and must return within 60 s. The
contract it imposes on the hook is the contract our provider port needs,
so it is copied here verbatim in spirit:

1. **Idempotent on the order id.** Redelivery spawns at most one runner:
   derive the resource name from the id and let the platform reject the
   duplicate.
2. **Never retry the workload.** One order id, at most one machine. If
   the runner never registers, the control plane re-requests with a new
   id after `--expected-spawn-seconds` (default 120, the server-side
   lease; set it to at least the p99 boot time).
3. **Exit codes carry the failure class.** 0 submitted; 1 retryable, the
   session backs off and is re-offered; 2 or more non-retryable, the
   session is blocked until a human presses Retry, with the tail of
   stderr as the reason.
4. **The spawned runner is bound to one session** (`--capacity 1`), and
   a pre-warmed one is unbound and claims like a fleet runner
   (`--min-idle N` on the orchestrator).

And the flags that make a per-session machine safe to own:
`--exit-if-unused-min` (a standby that never got work reclaims itself),
`--release-idle-session-min` (release the slot after N idle minutes
once a turn is finished; the session resumes on a fresh runner at the
next message), `--kill-session-after-min` (the hard backstop), and
`--retire-at <epoch>` for "infrastructure that destroys hosts at a known
wall-clock time without a signal, such as a sandbox lifetime cap or
spot-instance reclamation", which releases every session cleanly a few
minutes before the kill. The hook environment also carries the account
id and email of who queued the session "for per-account routing, quota,
or chargeback", and the primary repository URL "for routing to a runner
with that repository pre-warmed".

Two things they do that we should not copy. Their runner exits when its
sessions finish and is restarted with a fresh disk by Kubernetes, which
is right for a fleet and wrong for us: our runner already isolates by
worktree and the machine itself is the disposable unit. And their
control plane is the queue; ours assigns a session to a host before
anything is created (note 03 §3's "no pool to size"), so we spawn a
machine *for* a session rather than letting one claim it.

## 2. The decision: a cloud machine is a host that pairs itself

Note 03 §4 and note 10 §6 described the cloud adapter as "the runner
running in the control plane" with an "in-guest agent" registering a
JIT identity. That was written before the MVP runner existed. Now that
it does, the smaller design is:

- The control plane calls the provider to create a VM whose cloud-init
  runs **the ordinary install command** of `versions/mvp/09` §1 with a one-hour,
  single-use pairing token. The runner registers, the VM appears as a
  host owned by the person whose cloud account it is, and the session is
  dispatched to it exactly as to a Mac Studio: worktree, tmux, PTY over
  the link, credential helper minting one-hour repository tokens.
- The pairing token **is** the JIT identity note 03 wanted: it can do
  one thing, add one host to one person's account, and it is burned at
  registration, seconds after boot, before any session runs. Nothing
  long-lived is in user data, which matters because on all three clouds
  user data is readable by any process on the machine.
- The provider driver never touches a session: it creates, starts,
  stops, destroys and lists machines, and says what it can do.
  Everything session-shaped — dispatch, idle, the push before a stop,
  the log — is `sessions/` as built plus one fact: this host has a
  lifetime.

What it changes in the control plane is written where the control plane
is designed, `versions/mvp/03` §Cloud machines and `10`: `hosts/` is
the host factory — two person-owned rows, `cloud_account` and
`machine`, a `MachineProviderPort` with an adapter per provider in its
`infrastructure/`, `machine.hostId` set at registration and
`host_pairing_token.machineId` to join the two, `POST /sessions`
accepting a cloud account in place of a host — and there is no sixth
module and no package. One thing note 10 §10 decided changes: a
session on a cloud host defaults to **Keep**, paused when idle and
resumed when opened (§7), because a paused machine costs only its disk
on all three providers; **Ephemeral**, destroyed after N idle hours
with its branch pushed and its scrollback in the log, is the option
for one-task work and shows a timer instead of a moon.

```
console: New session, host chip = "AWS eu-central-1 (my account)"
   │
   ▼
POST /sessions ──► sessions/ creates the row, state=starting, event machine.requested
   │
   ▼
hosts/     mint a pairing token bound to a new machine row
           provider.create(spec, userData(install command + token), key = machine.id)
   │            ▲
   │            └── sweeper every minute: provider.list(tag) vs machine rows;
   │                anything unknown or past its TTL → destroy
   ▼
VM boots, cloud-init as root: create user `agent`, install git tmux node claude,
   loginctl enable-linger agent, then the installer as agent with its runtime env set (versions/mvp/09 §2)
   │
   ▼
POST /api/v1/hosts/register  ──► host row created, machine.hostId set, link comes up
   │
   ▼
sessions/ dispatches session.create to the new host  (the offline-host path 01 already has)
   │
   ▼
idle 30 min (the control plane's call) ──► session.stop push:true ──► provider.stop(suspend | stop) ──► machine.stopped
   resume: provider.start, then session.restart
Delete, or 7 d asleep ──► session.close ──► provider.destroy ──► machine.destroyed, host.unpairedAt
```

The provisioning steps the console already draws for a session (clone,
worktree, tmux, agent) gain four rows in front: *machine requested*,
*booting*, *runner online*, *paired*. Each is an event on the session
log, so the sidebar's boot trace is the same component.

## 3. What the research says the port must express

The port itself — verbs, errors, routes — is named once, in
`versions/mvp/03` §Cloud machines, and lives in `hosts/`. What the
provider research below fixes about it, so three drivers cannot drift:

- **Idempotency is a provider primitive on all three**, and the key
  must be ours: AWS `ClientToken` (64 ASCII characters,
  `IdempotentParameterMismatch` on reuse with other parameters, zonal
  when a subnet is given), Alibaba `ClientToken` (the same contract),
  Oracle's `opcRetryToken` on the launch request. Sending the `machine`
  row's id as that token is what makes "never retry a key" cheap.
- **Create returns before the machine exists** on all three;
  `RunInstances` and `launchInstance` are asynchronous, and Alibaba's
  docs say to poll `DescribeInstanceStatus` at one to two seconds. The
  waiter is the caller's, so the console can draw *booting*.
- **Suspend exists on one of the three.** AWS hibernates; Oracle and
  Alibaba only stop. That is why the port fails closed on `suspend`
  and the policy sends the verb it means, rather than a driver quietly
  turning one into the other: on Oracle a "suspended" session would
  otherwise be a boot and an agent resume with nothing in the row
  saying so.
- **A stop may not restart** on two of the three (Alibaba's
  documented inventory caveat; Oracle A1 capacity), which is why pause
  pushes and a refused start is a recreate, and why `stopMayNotRestart`
  is a capability rather than a retry loop.
- **Boot volumes go with the machine everywhere**: AWS
  `DeleteOnTermination`, Oracle `preserveBootVolume: false`, Alibaba
  `DeleteWithInstance`. The account volume of §8 is the only disk that
  outlives a machine, and it is a later slice.
- **Tags are the only scope all three IAM systems share**, with one
  rule: Alibaba rejects keys starting with `aliyun` or `acs:`, so the
  prefix is `oppenheimer:`. Oracle cannot condition a create or a
  power action on a tag, so there the compartment is the scope and the
  tag is for the sweeper only.
- **User data is readable by any process on the machine** on all
  three, and mutable only while stopped (AWS, Alibaba) or never
  (Oracle). Nothing but the one-hour pairing token goes in it, and
  every later secret arrives over the link.
- **The provider's capacity error is a class, not a code**: OCI
  `InternalError` "Out of host capacity", AWS
  `InsufficientInstanceCapacity`, Alibaba `OperationDenied.NoStock`
  all map to `MACHINE_CAPACITY`, retryable, versus the quota errors
  that need a person.

## 4. What each provider is, checked

### AWS EC2

- **SDK** `@aws-sdk/client-ec2` v3: `RunInstances`, `StartInstances`,
  `StopInstances` with `Hibernate: true`, `TerminateInstances`,
  `DescribeInstances`, `ModifyInstanceAttribute`; waiters
  `waitUntilInstanceRunning` and friends. `InstanceInitiatedShutdownBehavior:
  'terminate'` makes an in-guest `shutdown -h now` destroy the VM with no
  API call, which is the primary teardown (§7). `MetadataOptions.HttpTokens:
  'required'` forces IMDSv2. User data is 16 KB, base64, run once on
  first boot, editable only while stopped and then not re-run.
- **Suspend is real.** Hibernation needs an encrypted EBS root (gp3 is
  fine), a supported family (T3/T3a/T4g, M6i–M7a, C7g, M7g and more),
  under 150 GiB RAM, enabled at launch, and a supported AMI: Amazon
  Linux 2023 (arm64 since 2024.07.01), Ubuntu 22.04; **Ubuntu 24.04 is
  not on AWS's list** although Canonical shipped its hibinit agent for it
  in June 2024. Hibernated: no compute charge, EBS only, 60-day cap. So
  the AWS image is AL2023 arm64, not Ubuntu, if the Keep lifetime is to
  use suspend.
- **Stopped** costs EBS only, plus a public IPv4 if one is attached
  ($0.005/h since 2024-02-01); a one-minute minimum per start.
- **Price, Frankfurt, on demand / spot, 2026-09-22** (Linux, per hour):
  t4g.xlarge arm64 4 vCPU 16 GiB $0.154 / $0.072; c7g.xlarge 4/8
  $0.165 / $0.066; t3a.xlarge x86 4/16 $0.173 / $0.076; m7g.xlarge 4/16
  $0.196 / $0.065. gp3 ≈ $0.095 per GB-month in Frankfurt. Egress
  $0.09/GB after the first 100 GB a month.
- **Spot**: `InstanceMarketOptions` with `one-time` + `terminate` is
  self-cleaning; hibernation forces the `persistent` + `hibernate` pair.
  AWS says not to set a max price. Interruption is a two-minute notice,
  which is what `--retire-at` is for on their side and what the runner's
  "push before destroy" is for on ours.
- **Free tier since 2025-07-15** is credits, not hours: $100 at sign-up
  plus up to $100 for tasks, the free plan ends at six months or when
  the credits are gone, and free-plan eligible types are t3/t4g micro
  and small plus c7i-flex and m7i-flex large. A new account also has a
  **5 vCPU quota** for running on-demand standard instances and 5 for
  spot: one xlarge at a time until a Service Quotas request is granted.
  Request the increase on day one.
- **Access**: the SaaS pattern is a cross-account role the person
  creates in their account, trusting our account id, with an
  `sts:ExternalId` we generate per cloud account; we `AssumeRole` per
  call and store no key. Fallback for the first version: an IAM user's
  access key pair, stored encrypted, on a tag-scoped policy
  (`ec2:RunInstances` on `instance/*` and `volume/*` only with
  `aws:RequestTag/oppenheimer:managed=true`, `ec2:CreateTags` only with
  `ec2:CreateAction=RunInstances`, start/stop/terminate only with
  `ec2:ResourceTag/oppenheimer:managed=true`, `ec2:Describe*` on `*`).
- **Boot**: `running` about 7 s after the call, SSH-ready at 11 to 14 s
  on AL2023 and Ubuntu; installing Node and Claude Code in user data
  adds minutes and is the whole cost, so a prebaked AMI (EC2 Image
  Builder, no charge) is the second iteration.

### Oracle Cloud Infrastructure

- **SDK** `oci-common` + `oci-core` + `oci-workrequests`, weekly
  releases (v2.141.0 on 2026-09-15 adds Node 22 and 24):
  `launchInstance` with `shape: 'VM.Standard.A1.Flex'`,
  `shapeConfig: { ocpus, memoryInGBs }`, `metadata.user_data`;
  `instanceAction` START / STOP / SOFTSTOP; `terminateInstance` with
  `preserveBootVolume` default false; work-request waiters. Auth is an
  API signing key for a dedicated user in its own group, or instance
  principals if the control plane ever runs on OCI. **`user_data` and
  `ssh_authorized_keys` cannot be changed after launch**, stopped or
  not.
- **No suspend.** `instanceAction` has no suspend; stop and start on
  the same boot volume is the only sleep.
- **Stopped is free compute** for Standard and Flex shapes (A1, E4, E5,
  E6): billing stops at STOPPED. The boot volume keeps billing at
  $0.0255/GB-month plus $0.0017 per VPU, so a 50 GB balanced boot volume
  is about $2.13 a month; 50 GB is the minimum. An OS `shutdown` does
  **not** stop billing, only the API STOP does, so the in-guest teardown
  on OCI must be an API call from the control plane rather than
  `poweroff` (§7). Stopped instances still count toward service limits.
- **Price, global list, 2026-09-22, per hour**: A1.Flex $0.010 per OCPU
  plus $0.0015 per GB, so **4 OCPU / 16 GB is $0.064**, about $47 a
  month if never stopped; E4.Flex 4/16 $0.124; E5/E6.Flex 4/16 $0.152.
  Egress: the first 10 TB a month free, then $0.0085/GB in Europe. One
  price everywhere, so Frankfurt (three ADs) and Madrid (one) cost the
  same. Preemptible is 50% off but cannot stop, start or reboot and is
  terminated with two minutes' notice: not for an interactive session.
- **The $300 trial** lasts 30 days or until spent, then a 30-day grace
  where existing paid resources work but no new ones can be made. $300
  is about 4,700 hours of a 4/16 A1 machine: the trial cannot be spent
  on this workload in a month. **Always Free was halved on 2026-06-15**
  to 2 OCPU and 12 GB of A1 (1,500 OCPU-hours and 9,000 GB-hours a
  month), two E2.1.Micro AMD VMs, 200 GB of boot plus block storage,
  home region only; Always Free instances idle below 20% CPU, network
  and memory over seven days are reclaimed. Upgrading to Pay As You Go
  keeps Always Free and, per Oracle, "gives you access to more types of
  Compute resources", which is the documented answer to the next point.
- **"Out of host capacity"** for A1 is a documented known issue with
  documented workarounds: `CreateComputeCapacityReport` before
  launching, another availability domain, no fault domain, a smaller
  shape, retry after minutes. Frankfurt is reported to provision within
  minutes on paid tenancies; free and trial tenancies are where the
  famous retry loops live. The driver reports it as `MACHINE_CAPACITY`
  and the caller falls back to E4.Flex x86 at twice the price rather
  than looping.
- **Access**: a dedicated compartment per cloud account and a group
  policy `Allow group X to manage instance-family in compartment Y`,
  plus `use subnets`, `use vnics`, `use network-security-groups`, `read
  instance-images`, `inspect all-resources`. Tag conditions do not
  cover create or, for Compute, power actions, so the compartment is
  the scope and a compartment quota is the spend cap. NAT gateway,
  internet gateway and public IPs have no SKU: a private subnet with a
  NAT gateway costs nothing, so OCI is the one provider where the
  machine needs no public address at all.
- **Boot**: Oracle documents "several minutes"; community numbers for
  A1 are 45 to 90 s to a login. Platform images: Oracle Linux 8/9/10 and
  Ubuntu 22.04/24.04, both with aarch64, cloud-init preinstalled, users
  `opc` or `ubuntu`. A custom image from an instance shuts the instance
  down for minutes and is limited to one per instance per 20 minutes;
  fine for a prebake pipeline, not for anything per session.
- **Quotas**, per AD, paid tenancy: A1 16 OCPU / 96 GB, E4 6 OCPU /
  96 GB, E5 and E6 6 OCPU / 72 GB; trial tenancies are "dynamic".
  Stopped machines count, so a dozen sleeping sessions hit the limit
  before a dozen running ones would on AWS.

### Alibaba Cloud ECS

- **SDK** `@alicloud/ecs20140526` (Darabonba v2, regenerated from the
  API spec near-weekly, 7.11.6 on 2026-09-22) with
  `@alicloud/openapi-core` and `@alicloud/credentials`; not the legacy
  `@alicloud/pop-core` (last release 2024-12). `RunInstances` with
  `ImageFamily: 'acs:ubuntu_24_04_arm64'` or `_x64`, `UserData` (32 KB),
  `SpotStrategy`, `SystemDisk.Category: 'cloud_essd'` PL0,
  `InternetMaxBandwidthOut: 0` for no public IP, `ClientToken`, `Tag.N`;
  `StopInstance` with `StoppedMode: 'StopCharging'`; `DeleteInstance`
  with `Force: true`; `DescribeInstanceStatus` polled at one to two
  seconds. The API version string has been `2014-05-26` for twelve
  years. Throttling is a per-operation per-minute bucket (`RunInstances`
  100 per 60 s), not raisable.
- **No suspend in practice.** Hibernation exists but is GA only in
  Silicon Valley and Frankfurt, needs an encrypted custom image and a
  system disk twice the RAM, and the `Hibernate` parameter on
  `StopInstance` is "invitational preview". Treat as absent.
- **Stopped is free compute** with `StopCharging` (economical mode):
  vCPU, memory and the system public IP stop billing, disks and EIPs do
  not, the system public IP is released and a new one assigned on
  restart, and **the doc says the instance may not start again** when
  the zone has no inventory. Spot instances in economical mode add
  price fluctuation to that. `stopMayNotRestart: true`, and the caller
  treats a failed start as "recreate from image".
- **Price, 2026-09-22, per hour, on demand / spot**: Frankfurt
  c7a.xlarge (AMD, 4 vCPU 8 GB) $0.138 / $0.026, g7a.xlarge 4/16
  $0.196 / $0.043, g7.xlarge 4/16 $0.207 / $0.039; Singapore c7a.xlarge
  $0.150 / $0.036. **Arm (Yitian g8y/c8y) is sold outside China only in
  Singapore**, and the economy `ecs.e` family is mainland China only.
  ESSD PL0 ≈ $0.115 per GiB-month, PL1 ≈ $0.23. Egress by traffic
  $0.07 to $0.08 per GB, no hourly fee for a system public IP; a NAT
  gateway is $0.043/h plus $0.043 per GB, about $31 a month before
  traffic. Spot is "as low as 10%" of list, observed 80% off in
  Frankfurt, with a one-hour protection period and a five-minute
  interruption notice.
- **Free trial, international site, 2026**: needs a verified phone and
  a linked Visa/Mastercard/AMEX/JCB card, KYC if risk control fires,
  one account per identity, and only for accounts that never bought
  ECS. The ECS offer is one core and 1 GB for twelve months or two
  cores and 2 GB for three months, plus $300 to $1,200 of credits valid
  60 days. Too small for a session machine; the credits are the useful
  part.
- **Access**: RAM condition keys `acs:RequestTag` on `RunInstances` and
  `acs:ResourceTag` on stop, start and delete, an unconditioned
  `ecs:Describe*`, and an explicit **Deny** on `TagResources`,
  `UntagResources`, `CreateTags`, `DeleteTags` so the control plane
  cannot retag its way out. A RAM user with no console login holding an
  access key used only to `AssumeRole` into the role carrying the
  policy. A security group is deny-inbound by default.
- **Boot**: no official figure; cloud-init preinstalled with a native
  AliYun datasource; user data runs once on first boot, editable only
  while stopped and then not re-run. Region, zone, instance type, image
  and disk category form a compatibility matrix that differs by region
  (a March 2026 write-up needed seven attempts for one server), so the
  driver calls `DescribeAvailableResource` before `RunInstances` and
  picks the type per region at runtime. Quotas per family per region
  are unpublished and read from `DescribeAccountAttributes`.
- **Notable**: 17 regions outside mainland China; mainland regions
  need Chinese real-name verification and an ICP filing; the console
  moved to `*.console.alibabacloud.com` on 2026-01-20. Stable API,
  uneven inventory, the most paperwork of the three.

### Side by side, for the workload in note 10 §10

Ten ephemeral sessions, four hours each on 22 working days: 880 running
hours a month, a 4 vCPU / 16 GB machine where the provider sells one,
and the boot volume of whatever is stopped rather than destroyed.

| | AWS EC2 | Oracle Cloud | Alibaba Cloud |
|---|---|---|---|
| Machine | t4g.xlarge arm64, Frankfurt | A1.Flex 4 OCPU / 16 GB | c7a.xlarge 4/8 or g7a.xlarge 4/16, Frankfurt |
| Per hour on demand | $0.154 | $0.064 | $0.138 / $0.196 |
| Per hour spot / preemptible | $0.072 (can hibernate) | $0.032 (cannot stop: unusable) | $0.026 / $0.043 (may not restart) |
| 880 h on demand | **$135** | **$56** | **$121 / $172** |
| 880 h spot | $63 | n/a | $23 / $38 |
| Suspend (RAM kept) | yes, hibernate on AL2023 | no | no |
| Stopped, compute | free | free | free (economical mode) |
| Stopped, storage, 50 GB | ≈ $4.75 gp3 + $3.60 if a public IP stays | ≈ $2.13 | ≈ $5.75 PL0 |
| Stop may fail to restart | no | A1: capacity | documented |
| Free money today | $100 to $200 credits, 6 months, 5 vCPU quota | **$300 for 30 days**, then 2 OCPU / 12 GB free forever | $300+ credits, 60 days |
| Egress | $0.09/GB after 100 GB | free to 10 TB | $0.07 to $0.08/GB |
| Public IP | $3.60 a month, or NAT ≈ $32 + traffic | free, NAT free | free by traffic, NAT ≈ $31 + traffic |
| Arm | everywhere | everywhere | Singapore only |
| Paperwork | card | card, not charged until upgrade | card plus KYC |

Reading it: Oracle is the cheapest place to *run* this by a factor of
two, and the only one where sleeping is nearly free; AWS is the only
one with real suspend and the smoothest inventory; Alibaba is a
credible third with the most friction and no Arm in Europe. All three
are more than the dedicated host of note 10 §7 for a personal
workspace, which stays the recommendation for daily use; the cloud is
the overflow and the "no host yet" path.

## 5. Sizes, images, and what the runner needs on the box

The size catalog resolves per provider and region at create time,
because "4 vCPU 16 GB" is a different string on each cloud and Alibaba
changes it by region:

| Size | vCPU / GiB | AWS | OCI | Alibaba (Frankfurt / Singapore) |
|------|-----------|-----|-----|---------------------------------|
| small | 2 / 8 | t4g.large | A1.Flex 2 / 8 | c7a.large / c8y.large |
| medium (default) | 4 / 16 | t4g.xlarge | A1.Flex 4 / 16 | g7a.xlarge / g8y.xlarge |
| large | 8 / 32 | m7g.2xlarge | A1.Flex 8 / 32 | g7a.2xlarge / g8y.2xlarge |

Arm first: the runner already ships `linux/arm64` (`versions/mvp/09` §2), Node and
Claude Code run on it, and it is the cheapest tier on AWS and the only
tier on OCI's free money. `arch: 'amd64'` is a per-session override for
a repository that needs it (Docker images built for x86, a native
dependency), and on Alibaba in Europe it is the only option.

The image is the provider's Ubuntu 24.04 everywhere except AWS with a
Keep lifetime, where it is Amazon Linux 2023 because hibernation
demands it. Version one installs at boot from cloud-config: create the
`agent` user (the installer refuses root, and cloud-init runs as root),
`apt install git tmux`, Node 22 from NodeSource, `npm i -g
@anthropic-ai/claude-code`, `loginctl enable-linger agent` so the
user's systemd manager and bus exist before `runner install` asks
`systemctl --user` for a unit, then the installer as `agent` with
`XDG_RUNTIME_DIR` and `DBUS_SESSION_BUS_ADDRESS` set
(`versions/mvp/09` §2).
That is two to four minutes on all three clouds. Version two prebakes
the image per provider (Packer, or EC2 Image Builder on AWS, a custom
image from a stopped instance on OCI and Alibaba) and the cloud-config
shrinks to the install command; boot to online is then under a minute
on AWS and OCI. Note 03's Actuated lesson applies: one lean image with
git, tmux, Node, Claude Code, Docker, and the toolchains the person's
repositories actually use, rebuilt by CI, not a 3,000-package runner
image.

**Docker inside** is the one thing a cloud VM has that the MVP host
may not: it is a real VM, so `dockerd` is in the image, which is the
"VM per session" argument of note 10 §8 for free.

## 6. Connecting a cloud account

A cloud account is a person's, like a host (`ownerUserId`, no
`organizationId`; note 10 in `versions/mvp`), because the bill is
theirs and the machines it makes are hosts they own. It is a row
because it is revocable (the credentials rule in the same note). The
credential is the first secret the API stores as a *row* rather than
reads from config (the GitHub App key and the signing key are `.env`),
so the slice adds one root `.env` variable, `MACHINES_ENCRYPTION_KEY`,
and the credential is encrypted with it before it is written and never
leaves `hosts/infrastructure/`.

| Provider | What the person pastes | What we do on connect |
|----------|------------------------|-----------------------|
| AWS | a role ARN, after creating a role from our CloudFormation snippet that trusts our account with the ExternalId we show | `AssumeRole`, `DescribeRegions`, create the VPC + egress-only security group per chosen region, tag both, run `quote` |
| OCI | tenancy OCID, user OCID, fingerprint, region, private key, compartment OCID | `getCompartment`, create VCN + private subnet + NAT gateway (all free), the NSG with no ingress, run `quote` |
| Alibaba | RAM role ARN plus the RAM user's access key that may assume it | `AssumeRole`, `DescribeRegions`, create VPC + vSwitch + security group with no inbound rules, `DescribeAvailableResource` for the size catalog |

Choose a region on connect; the host chip lists each connected account
as `<provider> <region>` with the medium size's per-hour price, own
hosts first (note 10 §10). Disconnecting revokes the row and destroys
every machine it made after the sessions on them are closed; the VPC
stays, because deleting a network that something else in the person's
account might use is not ours to do.

Egress: no inbound rule on any provider ever, the runner dials out. On
AWS and Alibaba a public IP with a no-inbound security group is both
cheaper and simpler than a NAT gateway for a personal fleet ($3.60 a
month versus about $32 on AWS; $0 versus about $31 on Alibaba) and the
note 04's "no inbound port" findings hold because there is nothing listening.
On OCI the NAT gateway is free, so the machine gets no public address at
all. IMDSv2 required on AWS and Alibaba (`HttpTokens: 'required'`;
Alibaba's `100.100.100.200` endpoint with a token), which is what makes
"user data readable by any process" a one-hour-token problem rather
than a credential problem.

## 7. Pause, resume, and delete later

The headline of v0.2 is that a session on a cloud machine can be
**paused, resumed, and deleted later**, the way a laptop lid works,
with the machine costing nothing but its disk while it is closed. Note
10 §10 made Ephemeral (destroy after idle) the default on cloud hosts;
that changes. Stopped compute is free on all three providers (§4), so
the default on a cloud machine is the same as on an own host: **Keep**,
paused when idle, resumed when opened, deleted when you say so or after
a long sleep. Ephemeral stays as an option for one-task work. The
policy and its routes are `versions/mvp/03` §Cloud machines; this
section is what each verb *is* on each provider and why the policy has
the shape it has.

| | AWS EC2 | Oracle Cloud | Alibaba Cloud |
|---|---|---|---|
| **Pause** | `StopInstances` with `Hibernate: true`: RAM to the encrypted root volume, the agent mid-task, tmux and scrollback all kept | `instanceAction STOP` (the API call, never an OS shutdown, which keeps billing) | `StopInstance` with `StoppedMode: 'StopCharging'` |
| What survives | everything | the boot volume: worktrees, uncommitted changes, the agent's session files, the login | the same as Oracle |
| **Resume** | `StartInstances`: the terminal is live with the cursor where it was, no boot | `START`: the machine boots, the runner's user service comes up, reconnects the link, and the control plane's `restart` relaunches tmux and the agent with `claude --resume <id>` | the same, and a start that fails for inventory is a **recreate** |
| Resume time | tens of seconds: a new host reads the RAM image back | 45 to 90 s to a login, plus the runner and the resume | a minute or so; no official figure |
| Cost while paused | root volume plus the RAM image (t4g.xlarge: 40 GB + 16 GB gp3 ≈ $5.30 a month) plus $3.60 if a public IP stays attached | boot volume, 50 GB ≈ $2.13 a month | system disk, 40 GB PL0 ≈ $4.60 a month; the public IP is released and a new one assigned on resume |
| **Delete** | `TerminateInstances`, `DeleteOnTermination` volumes go with it | `terminateInstance`, `preserveBootVolume: false` | `DeleteInstance` with `Force: true`, `DeleteWithInstance` disks |
| Caveats | hibernate needs AL2023 (not Ubuntu 24.04), an encrypted root sized root + RAM, enabled at launch; caps at 60 days; a hibernate that fails "performs a normal shutdown", so the cold path below is the fallback on AWS too | stopped machines count against the OCPU limit (16 A1 OCPU per AD on a paid tenancy: **four** paused 4-OCPU machines); A1 capacity may be gone at resume | the doc says a stopped instance may not start when the zone has no inventory; spot adds price to that |

So there are two resume paths and every driver may need the second:
**warm** (AWS hibernate, processes intact) and **cold** (boot, relaunch,
`--resume`). The cold path is note 10 §1's hibernate column and needs
what `versions/mvp/02` §9 already records: the agent's native session
id, captured continuously, never at pause time. On wake the runner
does what note 10 §3 lists before it announces ready — mint a fresh
repository token, let `chrony` fix the clock — and on the cold path
the control plane's `restart` relaunches window 0 with the agent's
own `--resume` (`versions/mvp/02` §5).

**Pause pushes.** `session.stop` carries `push: true` on a host the
control plane can put to sleep (`versions/mvp/01`): the runner pushes
every checkout's working branch before ending the agent, the push
`close` performs without the removal. That is what makes a failed
resume on Alibaba or a capacity miss on Oracle a nuisance rather than
a loss: the **recreate** path builds a new machine from the image,
clones the pushed branches into a fresh worktree, and resumes the
agent by its session id. The session keeps its identity across a
recreate; the machine row does not.

**The policy picks the verb; the driver never degrades one.** Pause on
AWS is `stop('suspend')`; on Oracle and Alibaba it is `stop('stop')`,
because their capabilities say `suspend: false` and the port refuses a
`suspend` there rather than quietly stopping. Note 10 §6's "skip the
tier" rule, made a decision the row records instead of an alias inside
the driver.

**Idle is the control plane's call, and the guest never powers itself
off.** The sidebar group already says when a session is idle
(`versions/mvp/10`), so a session idle for thirty minutes on a cloud
host — longer than note 10 §2's ten, because a resume costs a boot on
two of the three providers — is paused by the sweeper, which sends the
stop and then the machine stop. The runner reports and the control
plane acts, on every provider alike; there is no runner flag for it,
and no in-guest shutdown, because on Oracle and Alibaba an OS shutdown
does **not** stop billing and an AWS-only trick
(`InstanceInitiatedShutdownBehavior`) would give one binary two
teardown protocols.

**Delete** is `close` then `destroy`: explicit from the session menu, or
automatic after **7 days asleep** (per-user, with a notice in the
sidebar three days before), and always before AWS's 60-day hibernate
cap. An Ephemeral session is the same thing with the delete at the
idle window instead of the pause.

```
running ──(idle 30 min)──► paused ──(asleep 7 d, or Delete)──► deleted
   ▲                          │
   └── resume, warm (AWS): tens of seconds, cursor where it was
   └── resume, cold (Oracle, Alibaba, AWS fallback): a boot, tmux relaunched, agent --resume
   └── recreate (start refused): new machine, clone the pushed branches, agent --resume
```

### Never leaking a machine

The ladder in `versions/mvp/03` §Cloud machines, and why each rung is
there:

1. **The event.** `session.stopped` on a cloud host is followed by the
   machine stop; `session.closed` by `destroy`. The runner's part is to
   report, which it already does.
2. **The sweeper, every minute, per cloud account.** `list(region,
   oppenheimer:managed)` against the `machine` rows catches the cases
   an event cannot: an instance with no row, a `running` machine whose
   session has been stopped past the grace period, a `stopped` machine
   past its 7 days, a `provisioning` machine older than the boot budget
   (300 s, the `--expected-spawn-seconds` of §1). This is the only thing
   that catches a machine whose user data never ran, and it is the
   rung Actuated's "everything around the VM is slow" lesson (note 03
   §3) says will fire.
3. **The provider's own safety.** Spot on AWS is `persistent` +
   `hibernate` (the only spot shape that survives a pause) or not used;
   an AWS Budget action stops tagged instances at a threshold the
   person sets on connect; an Oracle compartment quota caps the
   tenancy. Alibaba has budget alerts but no action, so the sweeper is
   the cap there.

One rule from the spawn hook carries into all of this: **a machine that
never paired is not retried on the same key**. The sweeper destroys it,
the session records `machine.lost`, and a fresh machine gets a fresh
id, so a provider that half-created something can never be asked to
finish it.

## 8. The gap that matters: the agent login

On your own host the Claude login is the host's own (00): you type it
once in the terminal and every session on that host spends it. An
ephemeral machine has no `~/.claude`, so every machine would ask you to
log in, and that is the one place this design is worse than Claude Code
on the web, where a session-scoped OAuth token is minted by the
control plane that also runs the model. We cannot mint one, and "no
vendor credential is ever stored by the platform" is in 00's *done
means*.

Two answers, in order:

- **Version one: the login button, once per machine.** The login URL
  Claude prints becomes a button (00), you tap it, the machine is
  logged in for its lifetime. Ten to fifteen seconds per ephemeral
  session, on a phone. Honest and cheap, and it is exactly the flow the
  MVP already has.
- **Version two: the account volume of note 10 §6.** A small provider
  block volume per cloud account holding the login directory
  (`CLAUDE_CONFIG_DIR`, note 06), attached to one machine at a time (the
  F13 rule), mounted by cloud-init before the runner starts. That is
  the accounts slice, and the first thing it needs is exactly this
  volume; the `MachineProvider` port grows `attachVolume` /
  `detachVolume` then, and not before. The credential never touches the
  control plane: it lives on a disk in the person's own cloud account.

`claude setup-token` and an API key in the environment are both ruled
out by *done means*; they would work in an afternoon and make the
platform a holder of vendor credentials.

## 9. What we looked at and did not take

- **Pulumi Automation API** (TypeScript, has `alicloud`, `oci` and
  `aws` providers) and **Terraform / OpenTofu**: desired-state engines
  that need their CLI binary in the container and reconcile a stack per
  call. Right for the VPC we create once on connect, wrong for a
  start/stop that happens hundreds of times a day. If the per-account
  network setup grows past three resources, the connect step can run a
  Pulumi program; the machine lifecycle never should.
- **SkyPilot**: Python, aimed at GPU jobs, supports AWS and OCI but not
  Alibaba, and owns the VM's lifecycle itself. The wrong language and
  the wrong owner.
- **Apache Libcloud** (Python, 35 providers, has OCI and Aliyun
  drivers) and **pkgcloud** (Node, AWS/Azure/DigitalOcean/OpenStack/
  Rackspace, no OCI or Alibaba, stale): a generic node abstraction
  is exactly the port of `versions/mvp/03`, and writing it over three official SDKs is
  three files, each a hundred lines of mapping. A generic library buys
  the fourth provider and costs us the capability flags that make the
  first three honest.
- **Sandbox services** (E2B, Daytona, Northflank BYOC, Fly Sprites):
  note 10 §7 already ruled them out for lifetime caps, no Docker, and
  price floors; Daytona has since gone closed-source (June 2026). BYOC
  offerings deploy a platform into your cloud account, which is a
  bigger thing to own than three drivers.
- **Managed Agents self-hosted sandboxes** and **Claude Code self-hosted
  environments**: Anthropic's runner on our machines. It validates the
  shape (§1) and is not usable as our runtime: the control plane is
  theirs, inference must be Anthropic-direct, and Team or Enterprise
  only.

## 10. Order of work: v0.2

1. **The port, the AWS driver, and pause, resume, delete**, all in
   `hosts/`: the two rows, connect with an access key pair first (the
   cross-account role is a CloudFormation template and a settings
   screen, a week on its own), the sweeper, the boot-trace rows, the
   `push` flag on stop and the cold resume in the runner (relaunch
   tmux, agent `--resume`, token rotation on wake) and the warm one on
   AWS (hibernate: AL2023 arm64 image, encrypted root sized root +
   RAM).
   Done means: New session on `AWS eu-central-1`, a t4g.xlarge boots and
   pairs, runs the demo scene; stop typing for thirty minutes and the
   machine hibernates and the sidebar shows the moon; open it from the
   phone and the cursor is where it was; Delete from the menu and the
   instance and its volumes are gone; `pnpm test` runs the driver
   against a recorded EC2 client; one real run costs under a dollar.
   Request the vCPU quota increase before starting.
2. **The OCI driver**, second, because two drivers make an interface and
   one makes a wrapper, and because the $300 is a 30-day clock: **do
   not start the trial until this driver is a week away.** Done means:
   the same scene on A1.Flex 4/16 in Frankfurt with the cold resume, a
   capacity error at create falls back to E4.Flex, a capacity error at
   resume takes the recreate path, and a paused session costs $2 a
   month. Upgrade the tenancy to Pay As You Go on day one of the trial;
   the card is not charged inside the credit, and that upgrade is the
   capacity workaround Oracle documents. Ask for the A1 limit increase
   the same day, because four paused machines is the paid default.
3. **Ephemeral as an option**: the same machinery with the delete at the
   idle window; a checkbox on New session, not the default.
4. **Prebaked images** per provider, when boot time is the complaint.
5. **The Alibaba driver**, when a user with an Alibaba account asks, or
   when the third driver is wanted as proof: x86 in Frankfurt, Arm in
   Singapore, `DescribeAvailableResource` before every create, the
   recreate path exercised on purpose.
6. **The account volume** (§8), with the accounts slice.

## 11. What this changes in the plan

- Note 03 §4's cloud bullet and note 10 §6 are rewritten: there is no
  guest agent, the ordinary runner pairs with an ordinary pairing
  token, and the adapter is a machine-lifecycle port with no session
  knowledge, owned by `hosts/` rather than a sixth module.
- The MVP design notes gain the decisions: `versions/mvp/03` the port,
  the routes and the pause, resume, delete policy; `10` the two rows;
  `01` the `push` flag on `stop`; `02` push-on-stop and the cold
  resume; `05` the host chip, the boot-trace rows and the session menu;
  `09` the cloud-init path. This note stays research.
- Note 10 §6's provider order "AWS first, Fly second, GCP and Azure
  after" is now **AWS, Oracle, Alibaba** in that note's body, driven by
  where the money and the accounts are; Fly, GCP, Azure and Hetzner
  Cloud are rows of the same table there, unscheduled drivers of the
  same port.
- Note 10 §10's "Ephemeral is the default on cloud hosts" is rewritten:
  stopped compute is free on all three providers, so the cloud default
  is Keep with pause and resume (§7), and Ephemeral is the option.
  Its teardown ladder and the boot-trace rows (§2) are new.
- This note is the design for **v0.2**: the slice after the MVP, with
  pause, resume and delete on cloud machines as its headline.
- `versions/mvp/00-scope.md` is unchanged: this is the slice after the
  MVP, not part of it. The MVP's install command and pairing token are
  what make the slice small, which is an argument for finishing them
  exactly as designed.

## Sources

- Claude Code in the cloud: <https://code.claude.com/docs/en/claude-code-on-the-web>;
  self-hosted environments: <https://code.claude.com/docs/en/self-hosted-environments>,
  configuration and the spawn-runner hook: <https://code.claude.com/docs/en/self-hosted-environments-configuration>,
  flag reference: <https://code.claude.com/docs/en/self-hosted-environments-reference>;
  Managed Agents environments: <https://platform.claude.com/docs/en/managed-agents/environments>
- AWS: RunInstances <https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_RunInstances.html>,
  StopInstances <https://docs.aws.amazon.com/AWSEC2/latest/APIReference/API_StopInstances.html>,
  idempotency <https://docs.aws.amazon.com/ec2/latest/devguide/ec2-api-idempotency.html>,
  JS v3 EC2 examples <https://docs.aws.amazon.com/code-library/latest/ug/javascript_3_ec2_code_examples.html>,
  hibernation prerequisites <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/hibernating-prerequisites.html>
  and overview <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-hibernate-overview.html>,
  Ubuntu 24.04 hibinit agent <https://bugs.launchpad.net/ubuntu/+source/ec2-hibinit-agent/+bug/2066999>,
  stop and start <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Stop_Start.html>,
  public IPv4 charge <https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights>,
  prices 2026-09-22 <https://ec2.shop?region=eu-central-1&filter=t4g.xlarge> and <https://instances.vantage.sh/aws/ec2/t4g.xlarge>,
  EBS <https://aws.amazon.com/ebs/pricing/>,
  free tier since July 2025 <https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/>
  and <https://aws.amazon.com/free/free-tier-faqs/>,
  tag-on-create IAM <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/supported-iam-actions-tagging.html>,
  confused deputy and ExternalId <https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html>,
  IMDSv2 defaults <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-IMDS-new-instances.html>,
  user data <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/user-data.html>,
  boot benchmarks <https://www.daemonology.net/blog/2021-08-12-EC2-boot-time-benchmarking.html> and <https://depot.dev/blog/faster-ec2-boot-time>,
  quotas <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-on-demand-instances.html>,
  shutdown behaviour <https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/Using_ChangingInstanceInitiatedShutdownBehavior.html>,
  budget actions <https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-controls.html>
- Oracle Cloud: TypeScript SDK releases <https://github.com/oracle/oci-typescript-sdk/releases>
  and launch example <https://github.com/oracle/oci-typescript-sdk/blob/master/examples/typescript/launch_instance.ts>,
  auth methods <https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdk_authentication_methods.htm>,
  instance actions <https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/restartinginstance-stop-instance.htm>,
  Always Free and idle reclamation <https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm>,
  trial and expiry <https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm>
  and <https://docs.oracle.com/en-us/iaas/Content/GSG/Tasks/signingup_topic-What_Happens_When_the_Promotion_Expires.htm>,
  A1 halving <https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/>,
  out of host capacity <https://docs.oracle.com/en-us/iaas/Content/Compute/known-issues.htm>,
  stopped billing <https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/resource-billing-stopped-instances.htm>
  and FAQ <https://www.oracle.com/cloud/compute/faq/>,
  boot volumes <https://docs.oracle.com/en-us/iaas/Content/Block/Concepts/bootvolumes.htm>,
  price list API <https://apexapps.oracle.com/pls/apex/cetools/api/v1/products/?currencyCode=USD>,
  preemptible <https://docs.oracle.com/en-us/iaas/Content/Compute/Concepts/preemptible.htm>,
  policy reference <https://docs.oracle.com/en-us/iaas/Content/Identity/Reference/corepolicyreference.htm>
  and tag conditions <https://docs.oracle.com/en-us/iaas/Content/Tagging/Tasks/managingaccesswithtags.htm>,
  NAT gateway <https://docs.oracle.com/en-us/iaas/Content/Network/Tasks/NATgateway.htm>,
  images <https://docs.oracle.com/en-us/iaas/Content/Compute/References/images.htm>
  and custom images <https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/managingcustomimages.htm>,
  service limits <https://docs.oracle.com/en-us/iaas/Content/General/Concepts/servicelimits.htm>
- Alibaba Cloud: `@alicloud/ecs20140526` on npm <https://registry.npmjs.org/@alicloud/ecs20140526>,
  Node credentials <https://www.alibabacloud.com/help/en/sdk/developer-reference/v2-manage-node-js-access-credentials>,
  RunInstances <https://www.alibabacloud.com/help/en/ecs/developer-reference/api-ecs-2014-05-26-runinstances>,
  StopInstance <https://www.alibabacloud.com/help/en/ecs/developer-reference/api-ecs-2014-05-26-stopinstance>,
  economical mode <https://www.alibabacloud.com/help/en/ecs/user-guide/economical-mode>,
  hibernation <https://www.alibabacloud.com/help/en/ecs/user-guide/hibernate-an-instance>,
  user data <https://www.alibabacloud.com/help/en/ecs/user-guide/customize-the-initialization-configuration-for-an-instance>,
  public images <https://www.alibabacloud.com/help/en/ecs/user-guide/public-mirroring-overview/>,
  spot <https://www.alibabacloud.com/help/en/ecs/user-guide/what-is-a-spot-instance>,
  block storage billing <https://www.alibabacloud.com/help/en/ecs/block-storage-devices>,
  public bandwidth <https://www.alibabacloud.com/help/en/ecs/public-bandwidth>,
  NAT gateway billing <https://www.alibabacloud.com/help/en/nat-gateway/nat-gateway-billing>,
  prices 2026-09-21 <https://sparecores.com/server/alicloud/ecs.c7a.xlarge> and siblings,
  free trial rules <https://www.alibabacloud.com/help/en/user-center/product-overview/learn-about-free-trials>,
  tag-based RAM <https://www.alibabacloud.com/help/en/resource-management/tag/use-cases/use-tags-to-control-access-to-ecs-resources-1>,
  quotas <https://www.alibabacloud.com/help/en/ecs/user-guide/quota-management>
  and throttling <https://www.alibabacloud.com/help/en/ecs/developer-reference/api-throttling>,
  regions <https://www.alibabacloud.com/help/en/ecs/product-overview/regions-and-zones>,
  provisioning friction <https://dev.to/osovsky/7-failed-attempts-to-create-one-cloud-server-on-alibaba-cloud-24gi>,
  cloud-init AliYun datasource <https://docs.cloud-init.io/en/latest/reference/datasources/aliyun.html>
- Alternatives: Pulumi Automation API <https://www.pulumi.com/docs/iac/using-pulumi/automation-api/getting-started-automation-api/>,
  SkyPilot <https://github.com/skypilot-org/skypilot>, pkgcloud <https://github.com/pkgcloud/pkgcloud>,
  Apache Libcloud <https://libcloud.apache.org/>,
  Daytona closed-source and self-hosting E2B <https://bex.co/blog/2026/07/12/daytona-vs-e2b-self-hosted-ai-sandbox>
