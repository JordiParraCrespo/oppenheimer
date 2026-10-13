# 23 — Plan, second cut: milestones, stats and Google accounts

The 2026-10-13 export redrew `design/version1/Tasks.dc.html`. Plan's
first version (17–20) is built; this note reads the new frame against
it and plans the backend and the architecture for what changed in
**tasks, milestones and the calendar**. The Projects section's agents
(the project agents, the project manager chat, their models, effort,
permission modes and threads) are planned elsewhere, by another agent;
this note only fixes the contract they build on (§7).

Nothing here is decided until the owner answers the questions at the
end. Where a section says "proposed", it is the recommendation.

## 1. What the frame changes

| Area | Built (17–20) | The 2026-10-13 frame | Whose |
|------|---------------|----------------------|-------|
| Goals | `goal` table, a strip over the board | Renamed **milestones**; a sidebar item of their own with a timeline per project (a bar from three weeks before today to ten days past the last milestone, a diamond per milestone, the project's % done) | This note, §2 |
| Sidebar | Tasks · Calendar | Tasks · **Milestones** · Calendar · **Projects** | Projects is the agents' |
| Project overview | — | Per project: tasks completed / total, in progress, **needs input** (blocked or overdue), next milestone, the in-progress list, the blockers, the milestones | Data here (§3), screen the agents' |
| Stats | — | Tasks completed and created per week, PRs opened, merged and closed, tokens per model, agent cost, a per-project table; presets (7 d … year to date) or a custom range, compared with the previous period | This note, §4 |
| Google Calendar | One connection per person | **Several Google accounts** per person, each with its own state (connected, needs reconnect), Add account, Remove | This note, §5 |
| New project | From the sessions sidebar | Also from Plan | No change: `POST /projects` |
| Agent permissions | — | `task.create`, `task.update`, `task.delete`, `ms.edit`, and session and PR keys; "Ask permissions" or "Auto", every change logged | Contract here (§7), the rest the agents' |

The frame computes "blocked" by matching `/block/i` against a task's
notes, and invents its stats series from a seeded random number. Both
are placeholders; §3 and §4 say what stands behind them.

## 2. Goals become milestones

**Proposed: rename all the way down, once, now.** Plan is in no release
yet and the API has no outside client that depends on `/goals`; a
product word that differs from the table, the route, the schema and the
console's feature files costs every future reader a translation. One
migration and one pull request:

- `ALTER TABLE goal RENAME TO milestone`, `task."goalId"` → `"milestoneId"`,
  every constraint and index renamed (`PK_milestone`,
  `UQ_milestone_organization_id_project`, `IDX_task_milestone`, the
  composite FK). Renames are metadata only: no rewrite, no long lock.
- Routes `/v1/milestones` (`GET ?projectId`, `POST`, `PATCH /:id`,
  `DELETE /:id`); `GET /tasks?milestoneId`. No `/goals` alias.
- `packages/shared`: `milestone.schema.ts` (split out of
  `task.schema.ts`), `MILESTONE_NAME_MAX`; the scope stays `tasks`
  (milestones ride on it, as goals did).
- `apps/api/src/tasks`: `Goal` → `Milestone` aggregate, commands,
  queries, mapper, DTOs, errors (`TASK_GOAL_*` → `TASK_MILESTONE_*`, with
  their rows in `apps/docs/docs/errors.md`).
- `pnpm generate:api-client`; the console's `goal` dialog, form, strip
  and `task-goal-row` follow; translations keys renamed.

The model does not change: a milestone has a name, a project and an
optional target date, and its progress is a count of its tasks. The
frame's "completed" milestone (it has tasks and all are Done) stays
computed, as progress is. The timeline needs nothing new from the
server: milestones with their counts (`GET /milestones`) and the
project's % done, which the console already holds in `GET /tasks`.

## 3. Needs input, and one owner for the project summary

The overview's tiles and the project manager's answers are the same
facts: done / total, in progress, needs input, next due task, next open
milestone. Two readers (the console and the agents) must not compute
them two ways.

**Blocked becomes a field.** Proposed: `task.blockedReason
varchar(500) null` and `task.blockedAt timestamptz null`, set together
(`CHECK`), through `PATCH /tasks/:id` (`{ blockedReason: string | null }`).
A person or an agent marks a task blocked and says why; Done clears it.
The card shows it; the frame's notes regex goes away. Overdue stays
what it is today: a due date before the viewer's today, computed by the
reader (19 §4).

**The summary is a pure function in `packages/shared`.**
`summarizePlan(tasks, milestones, today)` → per project `{ done, total,
doing, needsInput: [{ taskId, reason: 'blocked' | 'overdue' }],
nextDue, nextMilestone, status }`. The console calls it over the lists
it already reads. The API exposes the same function through an
in-process query, `FindPlanSummaryQuery({ organizationId, projectId?,
today })` in the tasks module, which the agents' tools call on the
query bus. No HTTP route until a client outside the console needs one
(17 "As built" dropped `GET /tasks/summary` for the same reason).

`today` is always passed in, never read from the server's clock, so a
person in Tokyo and the agent answering them agree on what is overdue.

## 4. Stats

One read: `GET /v1/plan/stats?from&to&tz&projectId?&compare=true`,
returning weekly buckets for the range (and, with `compare`, for the
same length just before it), the four headline totals, and the
per-project table when no project is given. Weeks start Monday in
`tz`. The range is capped at 53 weeks. The query lives in the tasks
module and composes three sources, each read through the port of the
module that owns the rows:

| Series | Source | What has to be built first |
|--------|--------|----------------------------|
| Tasks completed, created | `task_event` (below) | The event log |
| Tokens per model, agent cost | `session_turn`, through a sessions query port `SessionUsageReader` | Usage on a turn |
| PRs opened, merged, closed | The pull-requests module's analytics, through `PullRequestStatsReader` | A project → repositories attribution |

**Tasks: an event log, not `completedAt`.** `completedAt` is cleared
when a task is reopened and gone when it is deleted, so last month's
"completed" would shrink every time someone reopens or deletes. A new
append-only table, written in the same transaction as the change:

**`task_event`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId` | uuid | |
| `taskId` | uuid | no FK: the row outlives the task |
| `projectId` | uuid | the task's project at the time |
| `milestoneId` | uuid null | likewise |
| `kind` | varchar(24) | `created` · `completed` · `reopened` · `deleted` · `moved` · `edited` · `blocked` · `unblocked` · `session_linked`, a `CHECK` |
| `actorType` | varchar(8) | `user` · `agent` |
| `actorUserId` | uuid | the person, or the person the agent acts for |
| `actorAgentId` | uuid null | set when `actorType = 'agent'` |
| `payload` | jsonb | the fields that changed, small |
| `occurredAt` | timestamptz | |

Indexes `(organizationId, occurredAt)` and `(organizationId, projectId,
occurredAt)`. It does three jobs: stats (a reopen does not take back
last week's completion), the log the agents' "Auto"
mode promises ("each one is still logged here", §7), and the activity
a task dialog can show later. Retention: kept; at our scale it is a few
rows per task. Partition by month only if a workspace ever reaches
millions of rows. Backfill: one `created` per existing task at its
`createdAt`, one `completed` per Done task at its `completedAt`.

**Tokens and cost.** `session_turn` has `costUsd` and nothing else.
Claude Code's result carries the model and the usage; the runner
already relays the result for headless turns. Proposed: four nullable
columns on `session_turn` (`model varchar(64)`, `inputTokens`,
`outputTokens`, `cacheReadTokens` as `bigint`), filled where the drive
reports them, and an index `(organizationId, endedAt)`. Cost is the
reported `costUsd`, never computed from a price list we would have to
maintain. Interactive turns in tmux report nothing; the card says
"Measured on headless turns" until 0.7's chat drive closes the gap.
Project attribution is `work_session.projectId`. This touches the
runner and the protocol (01), so it is its own slice and its own
sign-off.

**Pull requests.** PRs are read from GitHub, not stored. The stats
query asks the pull-requests module for weekly opened / merged / closed
counts over the project's repositories (`project.repositories`); a PR
in a repository two projects share counts in both, and the table says
so. Every call goes through `UpstreamLimiter.exchange`
(`.agents/rules/integrations.md`); the result is cached in Redis per
`(organization, repositories, week)` for closed weeks, which never
change, and for five minutes for the current one.

**Computed on read.** `date_trunc('week', occurredAt AT TIME ZONE tz)`
over indexed ranges; no rollup tables until a measured query is slow.

## 5. Several Google accounts

Today `calendar_connection` is unique on `(organizationId, userId,
provider)`. The frame lists several accounts per person.

- **Key the account by Google's `sub`**, not the email (an address can
  change, `sub` cannot). The calendar grant adds `openid email` so the
  callback's ID token carries both. New column `accountSubject
  varchar(255)`; unique becomes `(organizationId, userId, provider,
  accountSubject)`. The existing row gets its `sub` on its next token
  refresh (the refresh returns an ID token once `openid` was granted);
  until then it is null, and a partial unique index covers the non-null
  rows. Cap: five accounts per person.
- **Routes**: `GET /calendar/google/connections` (list: id, email,
  status, connectedAt); `POST /calendar/google/connections` (start; the
  consent URL gets `prompt=consent select_account` so a second account
  can be chosen); `DELETE /calendar/google/connections/:id`
  (revoke at Google, delete the row); reconnect is a start with
  `login_hint` set to that account's email. The single-connection
  routes go.
- **Events**: `GET /calendar/google/events?from&to` reads every active
  connection in parallel, one `UpstreamLimiter` bucket per connection,
  tags each event with its `connectionId`, and drops duplicates by
  `iCalUID` (the same meeting invited to two of your addresses). It
  answers with `{ events, accounts: [{ id, status: 'ok' | 'revoked' |
  'error' }] }`, so one failing account marks only itself and the rest
  still draw. `invalid_grant` marks that row `revoked` as today.
- The Google layer stays one toggle; per-account toggles are a console
  question for later.

Personal events and task due dates do not change.

## 6. Live updates

Agents will change tasks while a person watches the board, so polling
every few seconds is no longer enough. The `workspace-events` module
already streams session, run and host changes to the console
(`GET /v1/events`). Proposed: the tasks module raises `TaskChanged` and
`MilestoneChanged` domain events through the outbox (id and kind only),
a handler in `workspace-events` publishes them, and the console
invalidates `GET /tasks` and `GET /milestones` on them. The calendar
does not need it.

## 7. The contract the agents build on

The agents' tools call the tasks module in-process, the same commands
the controllers send. What this module guarantees them:

- **An actor on every command.** `actor: { type: 'user' | 'agent',
  userId, agentId? }`, written to `task_event`. Controllers fill it from
  the request; the agents fill it with the agent and the person it acts
  for. Authorization stays the person's: an agent can do no more than
  its person may, intersected with the permissions its settings grant.
- **Permission keys map onto existing policies**: `task.create` →
  `create Task`, `task.update` → `update Task` (status, dates,
  milestone, blocked), `task.delete` → `delete Task`, `ms.edit` →
  `create`/`update Task` on milestones. The session and PR keys belong
  to the sessions and pull-requests modules.
- **No lost updates.** A `version` integer on `task` and `milestone`,
  bumped on every write; `PATCH` and `move` accept an optional
  `expectedVersion` (and `If-Match` over HTTP) and answer
  `TASK_VERSION_CONFLICT` (409) when it is stale. The console keeps
  sending none; agents always send one, so a person's edit made while
  the agent was thinking wins.
- **Idempotent creates.** `CreateTaskCommand` and
  `CreateMilestoneCommand` take an optional idempotency key, as
  starting a session from a task already does, so a retried tool call
  makes one task.
- **Reads**: `FindTasksQuery`, `FindMilestonesQuery`,
  `FindPlanSummaryQuery` (§3) and `FindPlanStatsQuery` (§4).

"Ask permissions" (propose, then apply on approval) is the agents'
module: it holds the proposal and sends the command when the person
approves. The tasks module has no pending-change state.

## 8. Slices

Each ships on its own, in this order, with the integration tests named.

1. **Milestones.** The rename (§2) end to end, and the Milestones
   sidebar item and timeline in the console. Tests: the migration up and
   down on a seeded database; every former goal behaviour in
   `tasks.integration.spec.ts` under its new name.
2. **The event log and the agent contract.** `task_event` with its
   backfill, `actor`, `version` and `expectedVersion`, idempotent
   creates, `TaskChanged` / `MilestoneChanged` on the workspace feed.
   Tests: every command writes exactly one event with its actor; a stale
   `expectedVersion` is refused and changes nothing; a create retried
   with one key makes one task; reopening a task leaves its `completed`
   event.
3. **Needs input.** `blockedReason`, `summarizePlan` in
   `packages/shared` with its unit tests, `FindPlanSummaryQuery`. This is
   what the agents' overview and the project manager read, so it lands
   before they need it.
4. **Stats: tasks.** `GET /plan/stats` with the task series and the
   per-project table; the token and PR series answer `null` and the
   console shows them as not measured yet. Tests: week bucketing across
   a DST change in `tz`; the comparison period; a deleted task still
   counts in the week it was completed.
5. **Several Google accounts** (§5). Tests: two accounts list, read and
   deduplicate; one revoked account leaves the other's events; the cap.
6. **Stats: tokens and cost.** Usage on `session_turn`, the runner and
   protocol change, `SessionUsageReader`.
7. **Stats: pull requests.** `PullRequestStatsReader` with its limiter
   bucket and cache.

Slices 1 to 3 are the agents' prerequisites. 4 and 5 are independent of
each other; 6 and 7 wait on their owners' modules.

## Open questions for the owner

1. **Rename all the way down** (§2), or keep `goal` in the code and say
   milestone only in the copy?
2. **Blocked as a field** (§3), or keep "needs input" as overdue only
   until a person asks for it?
3. **Who builds Stats?** It sits in the Projects section beside the
   agents' chat. Proposed: this plan owns the endpoint and the charts'
   data; the agents' plan owns the Projects screen that hosts them.
4. **Tokens and cost on headless turns only** at first, with the
   interactive gap labelled, or wait for 0.7?
5. **PRs in Stats** pull 0.2's GitHub reads into Plan. Ship Stats
   without them first (slice 4), or hold Stats until they are in?
6. Google: is five accounts per person the right cap, and should each
   account become its own layer toggle?
