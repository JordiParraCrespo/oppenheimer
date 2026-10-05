# 17 — Plan: tasks, goals and a calendar

The 2026-10-05 design export drew **Plan**, the console rail's third
item beside Sessions and Automations: a task board, goals over it, and
a calendar that puts Google Calendar beside task due dates and
automation runs. Plan is in the MVP (decided 1). This note is the
overview; 18 to 20 read the design as a product and as a backend.

The frames are `design/version1/Tasks.dc.html` (Plan) and the
"Back to task" chip in `design/version1/SessionsConsole.dc.html`.
They are the source of truth for what Plan *is*; these notes decide how
the control plane and the console make it true. The product word is
**Plan** for the section, **task** and **goal** for the things in it.

| # | Note | What it settles |
|---|------|-----------------|
| 18 | [The product](18-plan-product.md) | What the frames say Plan is, screen by screen, and the gaps they leave |
| 19 | [Tasks and goals: the backend](19-plan-tasks-and-goals.md) | The `tasks` module: tables, ordering, the API, starting a session from a task, links, and what the sessions module must add |
| 20 | [The calendar](20-plan-calendar.md) | The month view composed from four reads; Google read through a port, uncached on the server; personal events in one table |

## Slices

Built in this order, each usable on its own, behind the `plan` release
flag (one row in `packages/shared/src/feature-flags/catalog.ts`) until
the last one lands.

1. **Board.** Tasks and goals: tables, CRUD, reorder, the board, the task
   and goal dialogs, the project filter, the rail item and its open
   count. No sessions, no calendar. (19 §1–4, 18 §2–3)
2. **Tasks start sessions.** Start session from a card or the dialog,
   Link existing, the card's session line, the session header's "Back
   to task" chip, and Queued for an offline host. (19 §5–7, 18 §4)
3. **Calendar without Google.** The month view, task due dates and
   automation occurrences and personal events as layers, drag to
   reschedule. (20 §1–3)
4. **Google Calendar, read-only.** Connect, the Google layer read for
   the open month, the sidebar's connection card, Settings →
   Integrations. (20 §4–5)
5. **After the MVP, not designed here.** Writing back to Google, a task
   moving to Done when its PR merges (with 0.2's pull requests), a week
   view, tasks from GitHub Issues or Linear, Plan in Slack and on mobile.

## Decided

1. **Plan is in the MVP**, as the export drew it in `version1/` and on
   the console's rail, the way automations moved in
   (`16-automations-architecture.md` Q1). It absorbs what
   `../../next-steps/` had as 0.3 Kanban.
2. **Google Calendar is read-only first.** The grant asks for
   `calendar.readonly`; a Google event opens read-only with "Open in
   Google Calendar" and is not draggable, which departs from the frames.
   Writing back (`calendar.events`, conflict handling) is a later slice.
   (20 §4)
3. **Personal events stay.** Plan stores its own events beside the
   Google layer, in one table (20 §2).
4. **Only attaching a session moves a card.** Start and Link existing
   move Later or To do to In progress, one rule for both (18 §4, 19 §5).
   Nothing else moves a card for now; a merged PR moving it to Done waits
   for 0.2's pull requests.
5. **Queued is a console label** over `starting` + host offline, in the
   launch dialog and on the card's session line; session state does not
   change (19 §7).

Each note keeps its own smaller open questions; the decisions above are
logged in `README.md`.
