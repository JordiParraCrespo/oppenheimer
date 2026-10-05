# 02 — Tasks and goals: the backend

One new API module, `tasks/`, holding tasks, goals and the links from
tasks to sessions. It is a Domain-Driven Hexagon module like
`automations/` (`/scaffold-module`, `pnpm check:api-structure`), and its
tables follow `.agents/rules/database-design.md` (`/design-database`).
Goals live in it rather than in a module of their own: a goal has no
behaviour beyond grouping tasks and its progress is a count of them.

## 1. Tables

All tenant-scoped by `organizationId`, `uuid` keys, `timestamptz`,
composite foreign keys on `(organizationId, …)` as `work_session` uses
for projects.

**`goal`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId` | uuid | FK organization |
| `projectId` | uuid | FK `(organizationId, projectId)` → project; required |
| `name` | varchar(200) | |
| `targetDate` | date null | wall-clock date |
| `createdByUserId` | uuid | |
| `createdAt`, `updatedAt` | timestamptz | |

Index `(organizationId, projectId)`. Hard delete; tasks' `goalId` is
`ON DELETE SET NULL`.

**`task`**

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `organizationId` | uuid | |
| `projectId` | uuid | required; "None" is the Unassigned project |
| `goalId` | uuid null | FK → goal, `SET NULL` |
| `status` | varchar(16) | `later` · `todo` · `doing` · `done`, a `CHECK` and a shared Zod enum |
| `rank` | text, `COLLATE "C"` | order within a status (§2) |
| `title` | varchar(500) | |
| `notes` | text | `''` default, capped in the schema (10 000 chars) |
| `dueDate` | date null | |
| `dueTime` | time null | only with a `dueDate` (`CHECK`) |
| `completedAt` | timestamptz null | set when status becomes `done`, cleared when it leaves |
| `createdByUserId` | uuid | |
| `createdAt`, `updatedAt` | timestamptz | |

Indexes: `(organizationId, status, rank)` for the board,
`(organizationId, dueDate) WHERE dueDate IS NOT NULL` for the calendar
and the overdue count, `(goalId)` for goal progress. A goal's task must
share its project: enforced in the domain (the frames keep them in step)
and by the composite FK `(organizationId, goalId, projectId)` →
`goal(organizationId, id, projectId)`, which needs a unique constraint on
those three in `goal`.

**`task_session`** — the link.

| Column | Type | Notes |
|--------|------|-------|
| `taskId` | uuid | FK → task `ON DELETE CASCADE` |
| `sessionId` | uuid | FK → work_session `ON DELETE CASCADE` |
| `organizationId` | uuid | both FKs composite on it |
| `origin` | varchar(16) | `started` (from the task) or `linked` |
| `linkedByUserId` | uuid | |
| `createdAt` | timestamptz | |

PK `(taskId, sessionId)`; index `(organizationId, sessionId)` for "which
tasks is this session in".

## 2. Ordering

The board orders tasks within a column across every project, and the
filter only hides rows, so `rank` is per `(organizationId, status)`.
`rank` is a fractional index string (the `fractional-indexing` scheme:
a key between two neighbours, never renumbering). A move is one row's
`status` + `rank`; the client sends the ids of the neighbours it dropped
between (`afterId`, `beforeId`) and the server computes the key, so two
tabs cannot invent colliding keys. On the rare collision (same key from
two concurrent moves), the next move between them still sorts, and a
rebalance of one column is a background job, not a request path.

Ticking done puts the task at the top of Done; unticking at the top of
To do (the frames' behaviour), so the server needs "first in status"
too. New tasks go to the end of their column.

## 3. Domain

- `Task` aggregate: create, rename, edit notes, schedule (`dueDate`,
  `dueTime`), move (status + rank), complete / reopen, assign
  project and goal (goal implies project; a project change drops a goal
  from another project), link and unlink sessions, delete. Events:
  `TaskCreated`, `TaskMoved` (from, to), `TaskCompleted`, `TaskDeleted`,
  `TaskSessionLinked`, `TaskSessionUnlinked`, through the outbox like
  every other module, so 0.4 Slack and the activity feed have something
  to listen to.
- `Goal` aggregate: create, rename, retarget, move to another project
  (moves its tasks in the same transaction), delete. Progress is a
  query, not a stored number.
- Policies: a task's project must be active to start a session
  (reuse `require-active-project.policy.ts` through the projects port);
  the projects module's archive check gains a "tasks" usage entry
  (open tasks block archiving) in `project-usage.registry.ts`, beside
  the sessions one.

## 4. API

All under `/v1`, Swagger-decorated, `@RequireScopes`, `@CheckPolicies`.
New scope resource `tasks` (`tasks:read`, `tasks:write`) in
`packages/shared/src/scopes/catalog.ts`; goals ride on it. DTOs are Zod
schemas in `packages/shared/src/schemas/task.schema.ts` and
`goal.schema.ts`; then `pnpm generate:api-client`.

| Method and path | Use |
|-----------------|-----|
| `GET /tasks?projectId&goalId&status&dueFrom&dueTo&sessionId` | The board (all statuses, ordered), the calendar's due layer, the session header's lookup |
| `GET /tasks/summary?projectId` | Counts: open, doing, done, overdue, and open per project, for the header, sidebar and rail |
| `POST /tasks` | Create (title, notes, status, projectId, goalId, dueDate, dueTime) |
| `PATCH /tasks/:id` | Edit fields |
| `POST /tasks/:id/move` | `{ status, afterId?, beforeId? }` or `{ status, position: 'first' \| 'last' }` |
| `DELETE /tasks/:id` | Delete |
| `POST /tasks/:id/sessions` | Start a session from the task (§5) |
| `PUT /tasks/:id/sessions/:sessionId` · `DELETE …` | Link / unlink an existing session |
| `GET /goals?projectId` | Goals with `doneCount`, `totalCount` |
| `POST /goals` · `PATCH /goals/:id` · `DELETE /goals/:id` | |

`GET /tasks` returns each task with its linked sessions summarised
(`id`, `name`, state group, `updatedAt`, `origin`), read through a
sessions query port (`SessionSummaryReader`) in one batched call, so the
card's session line needs no second request. Overdue is computed by the
client against its own date (§1 of 01, open question 1); the summary
endpoint takes `today` as a parameter for the same reason.

Optimistic updates in the console (TanStack Query) for move, complete
and edit; the board refreshes on the existing `live-poll` cadence like
the session list. There is no push channel today, and Plan does not
need one to ship.

## 5. Starting a session from a task

The automations module already does this (`dispatch-automation-run`):
it sends the sessions module's `CreateSessionCommand` on the command bus
with an idempotency key and an `origin`. Tasks do the same.

`StartTaskSessionCommand` (`POST /tasks/:id/sessions`, body = the
launch dialog: `hostId`, `agent`, `launch.model`, `checkouts[0]`,
`prompt`, optional `attachmentIds`; header `Idempotency-Key`):

1. Load the task; refuse if its project is archived.
2. `CreateSessionCommand` with `projectId` = the task's project,
   `origin: 'task'`, `name` from the task title, and idempotency key
   `task:<taskId>:<client key>`. A retried request returns the same
   session.
3. In the tasks module's own transaction: insert `task_session` with
   `origin = 'started'`, and move the task to `doing` (top of the
   column) unless it is `done`. Emit `TaskSessionLinked` and, if it
   moved, `TaskMoved`.
4. Return the session and the updated task.

If step 3 fails after step 2 succeeded, the retry (same key) gets the
same session back and re-runs step 3, which is idempotent on the
`task_session` PK. No cross-module transaction is needed.

The sessions module adds `'task'` to the session `origin` values
(`work_session.origin` is `varchar(16)` already) and nothing else; it
does not know tasks exist.

## 6. The session's "Back to task" chip

The console asks `GET /tasks?sessionId=<id>` when it opens a session
and shows the task with `origin = 'started'`, else the latest link. The
sessions module's read model is unchanged.

## 7. Queued

The launch dialog's "Queue session" needs no new session state. Today
a session created for an offline host is saved `starting`, the dispatch
returns the hint `host_offline`, and
`sessions/application/session-reconciliation.resolver.ts` re-sends it
when the host reconnects. What is missing is the word:

- the session read model gains a derived `queued` flag (state `starting`
  and its host's link down), and the state groups show **Queued**
  instead of the start stepper;
- the launch dialog and New session both read the host's status and say
  "Queue session" for an offline host;
- the stepper starts when the host reconnects and the session leaves
  `queued`.

Open: a queued session that waits for days. Automations expire a
deferred run after a TTL (`automations/domain/fire-guard.policy.ts`); a
person's session should probably not expire silently. Proposed: no
expiry, and the card's session line reads "Queued · *host* offline".

## 8. Feature flag and rollout

`plan` (release flag, temporary, with an expiry in the catalog) gates the
rail item, the routes and the `tasks` controllers (`@RequireFlag('plan')`),
so slice 1 can merge before slice 2 exists.

## 9. Tests

- Integration (`apps/api`, real Postgres): move between neighbours and
  to first/last; concurrent moves to the same gap both persist and
  sort; a goal's project change moves its tasks; deleting a goal keeps
  its tasks; a goal and a task cannot disagree on project (the FK
  refuses it); starting from a task twice with one key yields one
  session and one link; starting moves To do → In progress and leaves
  Done alone; archiving a project with open tasks is refused.
- e2e: create a task, drag it to In progress, start a session from it on
  a real runner, see the session line and the Back to task chip.
