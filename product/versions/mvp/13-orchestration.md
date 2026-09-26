# 13 — Orchestration (v0.2)

How many runners there are, who decides where a session runs, what a
"queue" is in this system, and what survives what. Decided 2026-09-22
on top of what is built: the link and its in-process registry (03
§The relay), the transactional outbox (`apps/api/src/outbox`), the
BullMQ queue package, the session log as the truth (10), and the
microVM runtime (02 §14, note 15).

## Decided

- **One runner per host, many sessions per host, many hosts per
  person.** A runner is the host's agent, installed as that person's
  user service. Scaling out is more hosts, never more runners on one
  host. A host is either the person's own machine or one rented through
  the port in 03 §Cloud hosts; both run the same runner and the same
  microVMs.
- **The control plane assigns; hosts never claim.** A session is placed
  on a specific host at create (or as soon as a host exists), the rule
  note 03 §3 took from Actuated: assign before creating anything, so
  there is no pool to size. Anthropic's self-hosted runners do the
  opposite — a queue per environment, runners claim — and that is right
  for a fleet of identical containers restarted by Kubernetes; ours are
  a person's few machines with state on their disks, and the disk a
  session lives on is what decides where it resumes.
- **Three kinds of "queue", and none is a `jobs` table.** Sessions
  waiting for a host are rows in `starting` with no `hostId` yet (the
  row *is* the queue, as 10 decided for dispatch). Provider calls and
  the sweeper are **BullMQ jobs** on Redis, because they need retries,
  backoff, concurrency limits and to outlive a process. Domain events
  ride the **outbox** in-process, as today. The outbox announces,
  BullMQ works, Postgres decides.
- **Placement is a ladder, cheapest and fastest first**: a running host
  with room, then a stopped host (a start, 10 to 40 s on AWS), then a
  new rented host (a boot, a pairing, minutes), within the account's
  host cap. Own hosts sit at the top of the ladder and are never
  rented, stopped or destroyed by the platform.
- **Capacity is declared by the host and reserved by the row.** The
  runner reports `vmSlots` in its facts (cores at 2:1 CPU overcommit,
  memory at 4 GB per session, whichever is smaller; the numbers of
  note 10 §8) and the running count in every heartbeat; the control
  plane counts a `starting` session against a slot from the moment it
  is assigned, so two creates cannot both take the last one.
- **A session's persistence has four layers**, each cheaper and slower
  than the last: the running VM; the session disk on its host; the
  **transcript snapshot** in object storage plus the pushed branch on
  GitHub; and the session log in Postgres. Delete removes the first
  three; the log stays. The transcript snapshot is new: without it a
  rented host that is destroyed takes the agent's conversation with it,
  and "resume" would mean a fresh agent on the pushed branch.
- **VMs outlive the runner.** Firecracker runs in its own transient
  scope, not in the runner's cgroup, so a runner restart or self-update
  (09 §5) leaves every session running; the runner adopts them on boot
  by their sockets, the way it adopts tmux sessions today (02 §11).
- **One API replica holds links in v0.2**, and the seam that changes
  when that stops being true is one file (03 open question 4, confirmed
  there): presence and dispatch go through Redis, not through a bigger
  registry.

## 1. The shape

```
                browser ── attach socket ──┐
                                            ▼
            ┌──────────────── control plane (one API process, N later) ────────────────┐
            │  sessions/   hosts/ (+ the port)   relay/ + links/   outbox   BullMQ      │
            │  Postgres: rows + log      Redis: tickets, presence, jobs   S3: snapshots │
            └───────────────┬───────────────────────────┬──────────────────────────────┘
                     link (outbound)             link (outbound)
                            │                           │
                  ┌─────────┴─────────┐       ┌─────────┴─────────┐
                  │ own host (Hetzner) │       │ rented host (m8i) │   … up to the account's cap
                  │ runner            │       │ runner            │
                  │  ├─ VM session A  │       │  ├─ VM session D  │
                  │  ├─ VM session B  │       │  └─ VM session E  │
                  │  └─ VM session C  │       └───────────────────┘
                  └───────────────────┘
```

Nothing dials in. A host has one link; a session has one VM while it
is running and one disk always; a person has any number of hosts, each
with its own cap. The control plane is the only party that holds the
whole picture, and it holds it in Postgres.

## 2. Placement

`POST /sessions` names either a `hostId` (an own host, or a rented one
the person picked) or a `cloudAccountId` (let the platform place it).
With a `hostId` the MVP path runs unchanged: the row is created
`starting` on that host and `session.create` is dispatched, or waits
for the host's link. With a `cloudAccountId`, placement runs inside the
create transaction:

1. **A running host of that account and region with a free slot.**
   Free means `vmSlots` minus (running VMs from the last heartbeat plus
   `starting` and `open`-and-running sessions the rows already assign
   there). The most loaded host with room wins, so hosts drain and
   stop rather than all staying half full.
2. **A stopped host of the account with room.** The session is
   assigned to it, and a `machine.start` job is enqueued; the session
   waits with `machine.starting` on its log and the boot-trace row
   *Host starting*. Ten to forty seconds on AWS, one to three minutes
   on Oracle.
3. **A new host**, if the account has fewer hosts than its cap (default
   2; a per-account setting) and the region sells the shape: a
   `machine` row is created, a pairing token minted for it, a
   `machine.create` job enqueued, and the session waits with
   `machine.requested`, `hostId` still null, `machineId` set. When that
   machine's runner registers, `hosts/` raises `HostPaired` on the
   outbox; the sessions handler assigns every waiting session bound to
   that machine, in creation order and up to its slots, and dispatches
   them. The rest keep waiting for the next host or the next free slot.
4. **Nothing possible** — cap reached, region without the shape,
   account broken — is a refusal on the create with a reason the
   composer shows, never a session that waits forever.

Waiting is bounded: a session `starting` with no host for longer than
the boot budget (300 s) plus one retry gets `machine.lost` and `failed`,
with the provider's reason in the event. The sweeper (§6) is what
re-drives placement when an outbox event was lost between process
restarts: every minute it looks at `starting` sessions with no host and
runs the ladder again, idempotently.

**The reservation.** A slot is taken by the row, not by the runner's
answer: a `starting` session assigned to a host counts as running for
placement until the runner reports `vm.ready` or the session fails.
This is why placement runs under the host row's lock in the create
transaction, and why a heartbeat's running count is a check against
the rows rather than the source of the number — a runner that reports
fewer VMs than the rows say has lost some, and reconciliation (03
§Hello reconciliation) marks them stopped.

**Own hosts** take a session when the person picks them and are never
chosen by the ladder for a cloud-account create; the two are different
chips (05). Their `vmSlots` is enforced the same way, so a laptop with
8 GB refuses a fifth microVM rather than swapping.

## 3. Machine jobs

Every provider call is a **BullMQ job** on the `machines` queue
(`QUEUE_NAMES.MACHINES` in `@oppenheimer/shared`), processed by the
API's worker, one at a time per cloud account (a BullMQ group per
`cloudAccountId`, so two creates never race the account's quota) and
idempotent by design: the job id is `<verb>:<machineId>`, the provider
call carries the machine id as its client token, and the job's outcome
is written to the affected sessions' logs as `machine.*` events, which
the `machine` row folds into `state` the way `work_session` folds its
own.

| Job | Calls | On success | On failure |
|---|---|---|---|
| `machine.create` | `ensureNetwork` if the account has none in the region, then `create` | `machine.booting`; the pairing token's `machineId` joins the host row at registration (`machine.paired`) | `MACHINE_CAPACITY`: retry after 30 s with the next shape in the size's fallback list (E5 for A1 on Oracle, `m8i` for `c8i` on AWS), then after 2 min, then `machine.lost`. `MACHINE_QUOTA` and `MACHINE_CREDENTIALS`: no retry; the account is flagged, the waiting sessions fail with the reason, the console shows it on the account. `MACHINE_PROVIDER`: three retries with exponential backoff, then `machine.lost` |
| `machine.start` | `start`, then wait for the host's link (`HostOnline`) | `machine.started`; waiting sessions are dispatched | a start refused for capacity is the **recreate** path of 03 §Cloud hosts: `machine.destroy` of the old row, `machine.create` of a new one, the sessions re-dispatched onto it from their snapshots (§5) |
| `machine.stop` | `stop('stop')` | `machine.stopped` | retried; a host that will not stop is reported, never silently left running |
| `machine.destroy` | `destroy`, then `describe` until gone | `machine.destroyed`; the host row is unpaired | retried; the sweeper catches what stays |
| `machine.sweep` | `list` per account and region (repeatable, every minute) | §6 | — |

The jobs never talk to a session. What the sessions module needs to
know arrives as domain events through the outbox — `MachinePaired`,
`MachineStarted`, `MachineLost` — and the session handlers assign,
dispatch or fail rows in their own transactions. The one thing the two
share is the `machineId` on the session row while it waits.

Why BullMQ and not the outbox: the outbox is at-least-once **within the
process**, for domain events that must not be lost between a write and
its listeners. A provider call is different work — it takes seconds,
fails in ways that want a backoff, must be throttled per account, and
must be picked up by whichever process is alive. BullMQ on the Redis
the API already runs is that, with Bull Board to look at it.

## 4. Dispatch, across replicas

Today `links/` holds every host's link in an in-process map and
`RelayDispatchAdapter` writes frames to it. That stays the design for
one API process, and v0.2 runs one. The seam for the day the relay
splits (note 03 §5 says it is the first thing to) is already named in
03 open question 4; here is its shape, so nothing built now has to be
undone:

- **Presence in Redis**: every accepted link sets `host:<id>:link` to
  the replica's id with a 45 s TTL, refreshed by each heartbeat; the
  epoch rides along. `HOST_PRESENCE` keeps writing `lastSeenAt` to
  Postgres as today; Redis answers "who holds the socket now", Postgres
  answers "when was it last seen".
- **Dispatch by channel**: `SESSION_DISPATCH` publishes the frame on
  `host:<id>` with the epoch; the replica holding the link delivers it,
  and a frame with a stale epoch is dropped and re-driven by the
  reconciliation the next hello triggers. `delivered`, `host_offline`
  and `not_supported` keep their meanings; the adapter behind them
  changes.
- **Attach** follows presence: the attach socket may land on a replica
  that does not hold the host's link, and it relays over the same
  channel. Latency is one hop inside the region.

Until then, the registry is the map, and the sweeper plus hello
reconciliation are what make a lost in-process command harmless:
every command is idempotent by session id and command id (01), and
a host that reconnects announces what it holds.

## 5. Persistence: what lives where

| Where | What | Owner | Survives |
|---|---|---|---|
| **Postgres** | `work_session`, its checkouts and its **log**; `host`, `cloud_account`, `machine`; the folds | the control plane | everything; the log is the one truth and every row is a replay of it |
| **Redis** | attach tickets (60 s), link presence (45 s), the BullMQ queue | the control plane | nothing that matters: a lost Redis loses tickets and in-flight jobs, and the sweeper re-drives the jobs from the rows |
| **The host's disk** | the runner's `~/.oppenheimer` (config, key, `state/sessions.json`), the base image and kernel, one **session disk** per session (a reflinked, sparse ext4 file), the project stores (bare clones) | the runner | a runner restart and a host reboot; not the host's destruction |
| **Inside a session disk** | the worktrees and everything the agent wrote, `node_modules`, Docker's images, the agent's own session files (`~/.claude/projects/<cwd>/<id>.jsonl`, `~/.codex/sessions/…`), tmux's history while it runs | the guest | a VM stop and start; not a Delete, not a lost host |
| **Object storage** (`@oppenheimer/backend-storage`, S3 in production) | the **transcript snapshot**: the agent's session files, uploaded at every stop; later, other session artifacts | the control plane, keyed `sessions/<id>/transcript/<seq>.tar.zst` | a lost host, a recreate |
| **GitHub** | every pushed branch, `session/<id>/…` (10) | the person | everything on our side |
| **The runner's memory** | scrollback ring buffers (2 MB per session), the unacknowledged event batch | the runner | nothing; scrollback is not persisted by design (note 03 §1, F12) |

**The transcript snapshot** is the layer that was missing. On every
`session.stop` — the person's, the idle sweeper's, or the one before a
host stop — the control plane puts a presigned upload URL on the
command (01); after the push and before the VM is killed, the guest
agent tars the agent's session directory for that session, compresses
it and PUTs it there; the runner reports `session.stopped` with the
object's key and size in the event. A restart on the **same** disk
ignores the snapshot, since the disk has the newer copy. A restart on
a **fresh** disk — the recreate after a rented host is lost, or a
session moved to another host — gets a presigned download URL on the
`session.restart` frame: the guest clones the pushed branches, unpacks
the snapshot into place, and relaunches the agent with `--resume`,
which then finds its conversation exactly where it was. Ten to a few
hundred kilobytes for most sessions, capped at 50 MB; a session past
the cap is reported, snapshotted up to the cap from the newest end,
and still resumes. The bucket is encrypted at rest and the objects are
deleted with the session (F18 applies to them too). What this does not
persist: the shell history in the other tmux windows, and anything the
agent left uncommitted that the pause did not push — which is nothing,
because pause pushes.

**What "moving a session" means.** With the snapshot and the branch, a
session is not bound to a host: `restart` on a host other than the one
holding its disk is a recreate in all but name, and the old disk is
deleted once the new one has resumed. That is what lets the sweeper
drain a rented host that is about to be destroyed, and what a person
does when they move a session from a rented host to their own box.

## 6. What survives what

| Failure | What happens | Who acts |
|---|---|---|
| **Runner restart or self-update** | the VMs keep running in their own scopes; the runner adopts them from their sockets on boot and re-announces them in its hello; a browser reattaches after the link is back | the runner |
| **Host reboot** | the VMs are gone, the disks are intact; hello reports nothing running; reconciliation marks every session on the host `stopped` (`source: api`); each resumes on its next open | reconciliation |
| **Link down, host up** | sessions keep running; the browser gets `host_offline` on attach; the runner keeps its event batch until an ack; heartbeats stop and presence expires | nobody, until the link is back |
| **API process restart** | links reconnect (the runner's ladder), presence rebuilds from hellos, the outbox reclaims rows its old process held, BullMQ resumes jobs; every command is idempotent | the outbox and BullMQ |
| **Redis lost** | tickets and in-flight jobs are gone; the sweeper re-enqueues from the rows within a minute; links are unaffected | the sweeper |
| **Provider API down or refusing** | jobs back off and retry; sessions waiting on a host show *Host starting* with the last error; after the budget they fail with the reason | BullMQ, then the sweeper |
| **Rented host lost** (destroyed outside us, spot reclaimed, a start that will not come back) | `machine.lost`; the sessions on it are re-placed by the ladder and recreated from their snapshots and branches; the old row is destroyed | the sweeper, the session handlers |
| **Disk pressure on a host** | the runner's disk-pressure event (02 §10); placement skips the host; the console shows it on the host row | the runner reports, placement reads |
| **A VM that will not stop** | the runner kills it after the guest's grace (30 s after the push completes); a disk that was not unmounted replays its journal at the next boot | the runner |
| **Two processes think they hold a host** | the epoch on every frame; the older link is closed at hello, and a frame with a stale epoch is dropped | `links/` |

## 7. Idle, and the sweeper

One repeatable job a minute, per cloud account and for own hosts,
reading rows and provider listings and enqueuing the machine jobs of
§3. Idle is the control plane's decision (03 §Cloud hosts); the runner
reports the derived group and nothing else.

| Condition | Action | Default |
|---|---|---|
| a `microvm` session idle (derived group `idle`) on any host | `session.stop` with `push: true` and the snapshot URL; then the VM is killed | 30 min |
| a `host` runtime session idle | nothing: the MVP's "sleep is not a platform concern" holds for tmux on a machine you own | — |
| a rented host with no running VM | `machine.stop` | 30 min |
| a rented host stopped, whose sessions are all deleted or moved | `machine.destroy` | at once |
| a session stopped | delete: `session.close`, the disk and the snapshot removed, a notice three days before | 7 days |
| a session `starting` with no host | run the ladder again; past the budget, `machine.lost` and `failed` | 300 s, then once more |
| a `provisioning` machine past the budget | `machine.destroy`, `machine.lost` | 300 s |
| a provider instance with our tag and no row, or a `running` row with no running session past the grace | `destroy` or `stop` as its state requires | at once / 10 min |
| an Ephemeral session idle | `session.close` and the disk removed, instead of the stop | 30 min |

Every action the sweeper takes is an event on the session or machine
log, so the boot trace and the host row show why a machine went away.
Timeouts are per-person settings with these defaults, as note 10 §2
said.

## 8. Caps

| Cap | Default | Where |
|---|---|---|
| running sessions per person | 10 (note 10 §10) | `sessions/`, at create |
| hosts per cloud account | 2 | `cloud_account.maxHosts` |
| `vmSlots` per host | reported by the runner: min(cores × 2 ÷ 2, memory ÷ 4 GB) | host facts |
| session disk allowance | 40 GB sparse | the runner, from the create |
| snapshot size | 50 MB | the guest agent |
| waiting for a host | 300 s, twice | the sweeper |

## 9. Observability

The heartbeat's host facts gain `vmSlots`, `vmsRunning`, free memory
and the image version; the console's host row shows `3 / 8 sessions`
and the moon or timer per session. Every machine and VM transition is
an event on a log the person can read from the session. Bull Board,
already mounted by the queue package, shows the machine jobs and their
retries. What is not built: metrics export; the logs and the events are
the observability of v0.2.

## What this changes elsewhere

- 01: `session.stop` may carry `snapshotUploadUrl`; `session.create`
  and `session.restart` may carry `snapshotDownloadUrl`; `session.stopped`
  carries the snapshot's key and size. Host facts gain `vmSlots`.
- 02 §14: VMs run in their own transient scope and are adopted on boot;
  the guest agent makes and unpacks the snapshot.
- 03 §Cloud hosts: placement and the machine jobs are this document's;
  `POST /sessions` with `cloudAccountId` runs the ladder. `machine`
  rows fold `machine.*` events like sessions fold theirs.
- 10: `cloud_account.maxHosts`; `work_session.machineId` null while a
  session waits for a host; `QUEUE_NAMES.MACHINES`.
- `@oppenheimer/backend-storage` gains a use: the transcript snapshots,
  keyed by session.

## Open questions

1. The snapshot on every stop costs an upload per pause. Is a stop on
   the same host allowed to skip it when the disk is healthy, keeping
   the snapshot only for hosts that can be lost (rented) and for
   explicit moves? Cheaper; one more rule.
2. Should an own host's microVM sessions be paused by the same 30-minute
   idle rule? Freeing RAM on a laptop is a benefit; a paused session on
   a machine that is always on is a surprise. Default on for rented
   hosts, off for own hosts, and a setting?
3. `maxHosts` at 2: is a hard cap the right shape, or a monthly budget
   in the account's currency that the quote knows how to spend?
4. Session moves between hosts: a menu item in v0.2, or only the
   sweeper's drain?
