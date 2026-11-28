# Plan: tasks, goals and a calendar

The 2026-10-05 design export drew **Plan**, the console rail's third
item beside Sessions and Automations: a task board, goals over it, and
a calendar that puts Google Calendar beside task due dates and
automation runs. Plan is in the MVP (decided 1). This note is the
overview; `plan-product.md`, `plan-tasks-and-goals.md` and `plan-calendar.md` read the design as a product and as a backend.

The frames are `../../mockups/version1/Tasks.dc.html` (Plan) and the
"Back to task" chip in `../../mockups/version1/SessionsConsole.dc.html`.
They are the source of truth for what Plan *is*; these notes decide how
the control plane and the console make it true. The product word is
**Plan** for the section, **task** and **goal** for the things in it.

| Note | What it settles |
|------|-----------------|
| [The product](plan-product.md) | What the frames say Plan is, screen by screen, and the gaps they leave |
| [Tasks and goals: the backend](plan-tasks-and-goals.md) | The `tasks` module: tables, ordering, the API, starting a session from a task, links, and what the sessions module must add |
| [The calendar](plan-calendar.md) | The month view composed from four reads; Google read through a port, uncached on the server; personal events in one table |
| [Second cut](plan-milestones-stats-accounts.md) | The 2026-10-13 frame: milestones, needs input, Stats, several Google accounts (proposed) |

## Slices

Built in this order, each usable on its own. The plan was to keep them
behind a `plan` release flag until the last one landed; the first
version shipped all four at once with no flag (decided 6).

1. **Board.** Tasks and goals: tables, CRUD, reorder, the board, the task
   and goal dialogs, the project filter, the rail item and its open
   count. No sessions, no calendar. (`plan-tasks-and-goals.md` §1–4, `plan-product.md` §2–3)
2. **Tasks start sessions.** Start session from a card or the dialog,
   Link existing, the card's session line, the session header's "Back
   to task" chip, and Queued for an offline host. (`plan-tasks-and-goals.md` §5–7, `plan-product.md` §4)
3. **Calendar without Google.** The month view, task due dates and
   automation occurrences and personal events as layers, drag to
   reschedule. (`plan-calendar.md` §1–3)
4. **Google Calendar, read-only.** Connect, the Google layer read for
   the open month, the sidebar's connection card, Settings →
   Integrations. (`plan-calendar.md` §4–5)
5. **After the MVP, not designed here.** Writing back to Google, a task
   moving to Done when its PR merges (with 0.2's pull requests), a week
   view, tasks from GitHub Issues or Linear, Plan in Slack and on mobile.

## Decided

1. **Plan is in the MVP**, as the export drew it in `version1/` and on
   the console's rail, the way automations moved in
   (`../automations/automations-architecture.md` Q1). It absorbs what
   `../../roadmap.md` had as 0.3 Kanban.
2. **Google Calendar is read-only first.** The grant asks for
   `calendar.readonly`; a Google event opens read-only with "Open in
   Google Calendar" and is not draggable, which departs from the frames.
   Writing back (`calendar.events`, conflict handling) is a later slice.
   (`plan-calendar.md` §4)
3. **Personal events stay.** Plan stores its own events beside the
   Google layer, in one table (`plan-calendar.md` §2).
4. **Only attaching a session moves a card.** Start and Link existing
   move To do (and Later, while it existed) to In progress, one rule for both (`plan-product.md` §4, `plan-tasks-and-goals.md` §5).
   Nothing else moves a card for now; a merged PR moving it to Done waits
   for 0.2's pull requests.
5. **Queued is a console label** over `starting` + host offline, in the
   launch dialog and on the card's session line; session state does not
   change (`plan-tasks-and-goals.md` §7).

6. **No `plan` flag.** The first version ships the four slices together
   and live, so there is nothing to hide while the rest lands. The
   routes carry their policies and scopes like any other.

Each note keeps its own smaller open questions; the decisions above are
logged in `../../decisions.md`.

## As built (first version)

Where the build differs from `plan-product.md`, `plan-tasks-and-goals.md` and `plan-calendar.md` as written. The notes keep their text
and point here.

- **No flag** (decided 6): `plan-tasks-and-goals.md` §8 and the "behind the `plan` flag" lines
  in `plan-calendar.md` no longer hold.
- **No summary endpoint.** The board, the sidebar's counts and the rail's
  open count are one read, `GET /tasks`, which the console already holds
  for the columns; `GET /tasks/summary` (`plan-tasks-and-goals.md` §3) was not needed.
- **A session started from a task is a person's session**
  (`origin: 'person'`), started through the sessions module's own
  `CreateSessionCommand` with the idempotency key `task:<id>:<key>`. The
  link (`task_session.origin = 'started'`) is what says it came from a
  task; the sessions module gained no `'task'` origin (`plan-tasks-and-goals.md` §6).
- **Automation runs on the calendar are computed in the console** from
  the automations list it already reads: each schedule trigger carries its
  rule and zone, and `nextScheduleOccurrence` (`packages/shared`) places
  the runs for the month, as the scheduler would. Hourly rules are left
  off the grid. There is no `GET /automations/occurrences` (`plan-calendar.md` §3).
- **Event times are wall-clock**, like a task's due date: a day, and a
  start and an end on it as `HH:MM`, read in the viewer's zone. Google's
  events are asked for in the viewer's zone so both layers draw alike.
- **Archiving a project is not blocked by its tasks** (`plan-product.md` §6, `plan-tasks-and-goals.md` §2): the
  console leaves an archived project's tasks off its filter, and they keep
  their project. Revisit if open tasks on archived projects confuse people.
- **The sealer's key** is `CALENDAR_TOKEN_KEY`, 32 bytes in base64 (`plan-calendar.md` §5),
  and the Google redirect URI is `${FRONTEND_URL}/plan/calendar/google`, a
  console route that posts the code to the API.
- **Dragging on the calendar** moves a personal event or a task's due
  date to another day; Google's events and automation runs stay put.
- **Not built yet:** a Settings → Integrations page; the Google card in
  the calendar's sidebar is the one place to connect and disconnect.
