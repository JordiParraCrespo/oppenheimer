# 0.3 — Plan: tasks, goals and a calendar

The 2026-10-05 design export drew 0.3 as **Plan**, the console
rail's third item beside Sessions and Automations, holding a task board,
goals over it, and a calendar that puts Google Calendar beside task due
dates and automation runs. This directory is that design read as a
product and as a backend, one document per area, the way
[`../mvp/`](../mvp/README.md) is laid out.

The frames are `../mvp/design/version1/Tasks.dc.html` (Plan) and the
"Back to task" chip in `../mvp/design/version1/SessionsConsole.dc.html`.
They are the source of truth for what Plan *is*; these notes decide how
the control plane and the console make it true.

**Status: design.** The owner's questions are decided (below); nothing
is built. The product word is **Plan** for the
section, **task** and **goal** for the things in it.

| # | Note | What it settles |
|---|------|-----------------|
| 01 | [The product](01-product.md) | What the frames say Plan is, screen by screen, and the gaps they leave |
| 02 | [Tasks and goals: the backend](02-tasks-and-goals.md) | The `tasks` module: tables, ordering, the API, starting a session from a task, links, and what the sessions module must add |
| 03 | [The calendar](03-calendar.md) | The month view composed from four reads; Google read through a port, uncached on the server; personal events in one table |

## Slices

Each slice ships behind the `plan` release flag (one row in
`packages/shared/src/feature-flags/catalog.ts`) and is usable on its own.

1. **Board.** Tasks and goals: tables, CRUD, reorder, the board, the task
   and goal dialogs, the project filter, the rail item and its open
   count. No sessions, no calendar. (02 §1–4, 01 §2–3)
2. **Tasks start sessions.** Start session from a card or the dialog,
   Link existing, the card's session line, the session header's "Back
   to task" chip, and Queued for an offline host. (02 §5–7, 01 §4)
3. **Calendar without Google.** The month view, task due dates and
   automation occurrences and personal events as layers, drag to
   reschedule. (03 §1–3)
4. **Google Calendar, read-only.** Connect, the Google layer read for
   the open month, the sidebar's connection card, Settings →
   Integrations. (03 §4–5)
5. **Later, not designed here.** Writing back to Google, a task moving
   to Done when its PR merges (needs 0.2), a week view, tasks from
   GitHub Issues or Linear, Plan in Slack (0.4) and on mobile (0.5).

## Decided

1. **Plan is 0.3**, not the MVP. The export put it in `version1/` and
   on the MVP console's rail, as it did automations, which then moved
   into the MVP (`../mvp/16-automations-architecture.md` Q1); Plan does
   not. The MVP console does not show the Plan rail item until 0.3
   ships it behind the `plan` flag.
2. **Google Calendar is read-only first.** The grant asks for
   `calendar.readonly`; a Google event opens read-only with "Open in
   Google Calendar" and is not draggable, which departs from the frames.
   Writing back (`calendar.events`, conflict handling) is a later slice.
   (03 §4)
3. **Personal events stay.** Plan stores its own events beside the
   Google layer, in one table (03 §2).
4. **Only attaching a session moves a card.** Start and Link existing
   move Later or To do to In progress, one rule for both (01 §4, 02 §5).
   Nothing else moves a card for now; a merged PR moving it to Done waits
   for 0.2.
5. **Queued is a console label** over `starting` + host offline, in the
   launch dialog and on the card's session line; session state does not
   change (02 §7).

There are no open questions for the owner left; each note keeps its own
smaller ones.

## Decision log

- 2026-10-05: the owner decided Plan is 0.3, not the MVP, and Google
  Calendar is read-only first (`calendar.readonly`); two-way is a later
  slice.
- 2026-10-05: the owner decided personal events stay, only attaching a
  session moves a card for now, and Queued is a console label.
