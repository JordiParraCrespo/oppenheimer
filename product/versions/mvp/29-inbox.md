# 29 — Inbox: one place for what needs you

The 2026-10-25 export draws an **Inbox** (`design/version1/Brain.dc.html`):
a new first rail item with a bell, where sign-in lands. On the left, a
list of what needs you; on the right, a chat-shaped pane that brings
those things one at a time, each with the controls to answer it, and a
log of what you did. The owner set the first version on 2026-10-25:
**minimal, and only from what the system already knows** — no new way
for agents or sessions to post into it yet. The 2026-10-26 export adds
a menu on every row (Mark as done, Deprioritize, Snooze, Delete) and a
Snoozed list, and keeps the filter by project; §3 and §4 cover them.

The reasoning is in `../../research/focus-and-attention.md`: one place,
one thing at a time, most blocked first, instead of a person watching
every list.

## 1. What the first version shows

Four sources, each already in the API. The items themselves are not
stored: an item is there while its source says it needs you, and gone
when it does not. What is stored is only what you did to one (§3). A
workspace has one member today (`08-auth.md`), so "workspace-wide" is
"yours".

| Item | Source | Needs you when | Answer in the Inbox |
|------|--------|----------------|---------------------|
| **A session waiting on you** | `GET /v1/sessions`, derived group `waiting-on-you` | the agent has been `blocked` 30 s or more, the session `failed`, or it has been `starting` 60 s or more (`sessions/domain/session-group.policy.ts`) | **Open** the session. A Claude Code question is answered in its chat view (`#462`); the Inbox cannot show the question, see §3 |
| **A bot's approval** | `bot_approval` with `status = 'pending'`, at most one per bot | a bot stopped its turn on a tool the owner set to *ask* (`25-bots.md`) | **Approve / Deny** through the existing `POST /v1/bots/:id/approvals/:approvalId/decision` |
| **A pull request for you** | `GET /v1/pulls?scope=requested`, and `scope=mine` with `blocker = null` | a review is requested of you, or your pull request can merge | **Merge** through the existing `POST /v1/pulls/:installationId/:githubRepoId/:number/merge` for a mergeable one; **Review** opens it in Pull requests |
| **An automation that failed** | `GET /v1/automation-runs?status=failed&window=24h` | a run failed in the last day | **Run again** (`POST /v1/automations/:id/run`); **Open run** |

**Order**, most blocked first: bot approvals and sessions waiting, oldest
wait first (each stalls an agent); then pull requests requested of you;
then pull requests ready to merge; then failed runs. A deprioritized item
sorts after all of them and reads *Low*.

**Project.** Every item carries the project it belongs to, so the list
filters by project as the frame does, with a count beside each:

| Item | Its project |
|------|-------------|
| Session | `work_session.projectId`, set at creation; New session now picks it (or No project) in the 2026-10-26 composer |
| Bot approval | the project of the session it concerns (`bot_approval.sessionId`), else none |
| Pull request | every project holding its repository (`project_repository.githubRepoId`); none when no project holds it |
| Automation run | `automation.projectId` |

An item with no project shows under *No project*; one whose repository
two projects hold counts in both.

## 3. What you can do to an item

The row's menu, from the 2026-10-26 frame. These are the only things the
Inbox stores.

| Action | Effect |
|--------|--------|
| **Mark as done** | Hides this occurrence and adds a line to the log; under *Show done* until you leave |
| **Deprioritize** / **Restore priority** | Sorts it last and labels it *Low*; restore puts it back in order |
| **Snooze 1 hour** / **until tomorrow** | Hides it until then, in the **Snoozed** list with **Bring back** |
| **Delete** | Hides this occurrence for good, with no log line |

**An occurrence, not a thing.** A mark is keyed by the item *and* the
wait it answers, so a new wait comes back however the last one was
marked: a session by its id and the moment its agent became blocked
(`observedSince`), an approval by its id, a pull request by repository,
number and head commit (a new push asks again), a run by its id. Marks
whose source no longer needs you are simply never read; a nightly
sweep deletes those older than 30 days.

**Table `inbox_mark`** (`.agents/rules/database-design.md`): `id` uuid,
`organizationId`, `userId` (a mark is a person's, ready for shared
workspaces), `itemKey` varchar(200) (`session:<id>:<observedSince>`,
`approval:<id>`, `pull:<repoId>#<number>@<sha>`, `run:<id>`), `mark`
(`done | low | snoozed | deleted`), `until` timestamptz null (snoozed
only), `createdAt`, `updatedAt`; unique `(organizationId, userId,
itemKey)`, which is also the read's index.


## 4. The API: two small additions and the marks

The console composes the four reads, the way Plan's calendar composes its
layers (`20-plan-calendar.md`): no server-side join, and no table of
items. Three of the reads exist. Three things are missing:

1. **Pending approvals across bots.** Today only
   `GET /v1/bots/:id/approvals` exists, one bot at a time. Add
   `GET /v1/bot-approvals?status=pending` to `bots-chat`: the workspace's
   pending approvals on bots the caller may read, newest first, with the
   bot's name. It needs an index on `(organizationId, status, createdAt)`
   or a partial one on `organizationId` where `status = 'pending'`
   (`.agents/rules/database-design.md`). Scope `bots:read`.
   *Built 2026-10-26:* "may read", as the per-bot `GET /bots/:id/approvals`
   it mirrors (deciding still asks `update`), and the full
   `IDX_bot_approval_org_status ("organizationId", status, "createdAt", id)`,
   since the route takes any status (`pending` by default), at most 100.
2. **A workspace event for approvals.** Approvals only stream on the
   per-bot SSE. Add `{ type: 'botApproval.changed'; id; botId }` to
   `WorkspaceEvent`, published when an approval is created or decided,
   and add its key to `useWorkspaceEvents`' map. Sessions and automation
   runs already stream (`session.changed`, `automationRun.changed`); pull
   requests stay polled, as the Pull requests queue is today.
3. **The marks**, a small `inbox` module: `GET /v1/inbox/marks` (the
   caller's marks, snoozed ones past `until` left out),
   `PUT /v1/inbox/marks/:itemKey` with `{ mark, until? }`, and
   `DELETE /v1/inbox/marks/:itemKey` for Bring back and Restore priority.
   Scope `inbox:write` for the writes, `inbox:read` for the read. An
   `inboxMark.changed` event to the person keeps two tabs in step.

## 5. The console

- **Rail.** `inbox` becomes the first id in `RAIL_ROUTES`
  (`apps/web/src/features/sessions/lib/rail-landing.ts`) with a bell icon
  and a count of open items, at `/inbox`. A person who never reordered
  the rail lands on it; a stored order gets it appended, see open
  question 1.
- **The list (left).** One row per item: icon by kind, a short line,
  where it comes from, how long it has waited, and its menu (§3). Filters
  by kind and by project, and *Show done*. A **Snoozed** section under
  the list, with when each comes back. The row in the pane is selected.
- **The pane (right).** The current item as one card, the frame's shape:
  who it is from, the question in a sentence, the facts (a pull request's
  checks and size, a run's failure line), and its answer buttons from §1.
  Answering adds a line to the pane's log above it ("Merged #121 into
  main", "Approved Ops · start_session") and brings the next item. With
  nothing left: "You're clear", with the count of sessions still running.
- **The log** lives in the page's memory for this visit; the marks behind
  it are stored, the log lines are not.
- **Not in the first version:** the frame's message box to the
  Oppenheimer bot, its model and effort menus, suggestions, email items,
  and the general bot itself (the export's "Oppenheimer", which no note
  covers yet).

**Claude Code questions** are read from the agent's transcript, which
only exists in a browser attached to the session's terminal; nothing on
the server has the question or its options, and permission prompts are
not modelled at all. The first version therefore opens the session for
those. Showing the question and its options in the Inbox, and answering
from there, needs the runner to report a pending question to the API as a
session event: that is slice 4.

## 6. Slices

1. **API**: `GET /v1/bot-approvals?status=pending` with its index and
   tests; `botApproval.changed` on the workspace stream; the `inbox`
   module with `inbox_mark`, its three routes and its event; regenerate
   the API client.
2. **Console**: the `inbox` rail item and `/inbox` route, the list with
   kind and project filters and the pane with the four kinds and their
   answers, the count on the rail, light and dark screenshots.
3. **The row menu**: done, deprioritize, snooze, delete and the Snoozed
   list on top of slice 2.
4. **Questions in the Inbox**: the runner reports a pending Claude Code
   question (header, question, options) as a session event, the API keeps
   the latest open one on the session, and the Inbox answers it.
   The server half is built (below); the console's card and answer are not.
5. **Later, not planned here**: the message box to a general bot, items
   that agents and sessions post themselves, email and customer chats
   (`../../next-steps/channels.md`), batched delivery during a focus
   block (the research note §3).

## Decided (2026-10-26)

The owner asked for the feature to be built end to end without stopping
for these; they were settled with the defaults below and can be changed.

1. **Rail position.** Inbox goes first for everyone once: a stored rail
   order that lacks it gets it at the front, not the end, so it is where
   the console lands.
2. **Failed runs** show for 24 hours after the run, then drop out.
3. **A failed session** stays in, as `waiting-on-you` already counts it.
4. **Delete** is kept, as the frame draws it: it hides the occurrence
   with no log line, and clears a done item from *Show done*.
5. **A `release` flag `inbox`**, on by default, expiring 2026-12-31.

## As built: the console (2026-10-26)

Slices 2 and 3 together: the rail item and `/inbox`, the list in the
console's sidebar, the pane, and the row menu with the Snoozed list.
Where it departs from the note above:

- **The keys' inputs.** No read reported what §3 keys by, so two small
  additions came with it: a session now answers `observedSince` and
  `stateSeq`, and every pull request row its `headSha` (only the briefing
  had it). A blocked session is `session:<id>:<observedSince>`; a failed
  or stuck launch, which records no moment its wait began, is
  `session:<id>:s<stateSeq>` (one failure is told from the next by the
  change count). Approvals, pull requests and runs are as §3 says.
- **An approval's project** is that of the session it started or the one
  its call names (`session_id`); a pending card has started none, so most
  are under No project until bots carry projects of their own.
- **Failed runs** are the workspace's automations' (`GET
  /automation-runs` lists session automations only); a bot's routine
  that fails is answered in its bot's chat. *Run again* also marks the
  failed run done: it stays failed for the day it shows.
- **Answering** an approval or a merge hides the item at once and logs it
  without storing a mark (its source drops it); *Open session* only opens.
- **The row menu's keys**: E and L act on the item in the pane and are
  painted on its row only; Delete has no key.
- **Show done** is on by default, as the frame draws it, and lists only
  what was marked done on this visit; the list's facets, Show done and
  the item in the pane are the address's search (`?type`, `?project`,
  `?hideDone`, `?item`). The log, Later and Show done are the page's
  memory, cleared on leaving the Inbox.
- **Snooze until tomorrow** brings it back at 09:00 the reader's time.
- **Off flag**: the rail drops the item and `/inbox` goes on to New
  session, which is where the console landed before.
- **A blocked session never reached the Inbox** on a real runner: the
  runner announced a state only when it changed, and the control plane
  starts the 30 s clock only on a second report of the same state, so
  `waiting-on-you` from a question never fired, in the sidebar either.
  The runner now announces a blocked agent once more after 15 s
  (`02-runner.md` §9), and `e2e/tests/fleet/inbox-session.spec.ts` proves
  it end to end: a session on a real runner prints Claude Code's
  question, shows in the Inbox about 45 s later, and opens from its card.

## As built: the server for slice 4 (2026-10-27)

- **Two kinds of decision**, `SessionDecision` in
  `packages/shared/src/schemas/session-decision.schema.ts`: a `question`
  (an `AskUserQuestion` call, `id` its `tool_use_id`, up to four questions
  of up to six options, header and descriptions nullable) and a
  `permission` (Claude Code's dialog, `id` a hash of its text, a `title`,
  a nullable `detail` and two to nine options in screen order). Permission
  prompts were not modelled before; they are now, read off the screen.
- **The event.** The runner logs `agent.decision` `{ decision }` when what a
  blocked agent waits on appears, changes or clears (`02-runner.md` §9).
  The fold keeps it as `pendingDecision` (a `jsonb` column on
  `work_session`) and clears it on a null report, on any observed state
  but `blocked`, on stop, failure, close or restart, and on
  `decision.answered`. Sessions answer it as `decision`, null when
  nothing is pending.
- **The route.** `POST /v1/sessions/:id/decision` (`answerSessionDecision`
  in the client, `sessions:write`, `update Session`) with `{ id, answers:
  [{ picks, other }] }` for a question or `{ id, option }` for a
  permission. An `id` that is not the pending one is `SESSIONS_032`; an
  answer that does not fit (an index out of range, two picks or a pick and
  words for one choice) `SESSIONS_033`; a host with no link
  `SESSIONS_034`, and the decision stays pending.
- **The keys.** The answer is typed into window 0 as the keys a person
  would press, one `session.input` per key, 120 ms apart: `questionKeys`
  (moved to `@oppenheimer/shared/sessions`, so the chat view and the API
  share one encoding) for a question, the option's number for a
  permission. Then `decision.answered { id }` clears it at once; the
  runner's next report confirms.
- **Not certain:** the dialog parser was written against the dialog's
  shape in Claude Code 2.x (a rule or a box, the tool's name and command,
  the question, `❯ 1. Yes` …, a footer) and the fleet spec's printed
  question; a release that draws it differently reports no permission
  decision, and the Inbox then only opens the session, as before.
