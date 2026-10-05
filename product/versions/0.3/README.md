# 0.3 — Plan: tasks, goals and a calendar

The 0.3 sketch ([`../../next-steps/0.3-kanban.md`](../../next-steps/0.3-kanban.md))
asked for "a kanban board linked to projects and everything else". The
2026-10-05 design export drew it, and drew more: **Plan**, the console
rail's third item beside Sessions and Automations, holding a task board,
goals over it, and a calendar that puts Google Calendar beside task due
dates and automation runs. This directory is that design read as a
product and as a backend, one document per area, the way
[`../mvp/`](../mvp/README.md) is laid out.

The frames are `../mvp/design/version1/Tasks.dc.html` (Plan) and the
"Back to task" chip in `../mvp/design/version1/SessionsConsole.dc.html`.
They are the source of truth for what Plan *is*; these notes decide how
the control plane and the console make it true.

**Status: proposal.** Everything under "Proposed" below is a
recommendation waiting on the owner; nothing is built.

| # | Note | What it settles |
|---|------|-----------------|
| 01 | [The product](01-product.md) | What the frames say Plan is, screen by screen, and the answers they give to the 0.3 sketch's five questions |
| 02 | [Tasks and goals: the backend](02-tasks-and-goals.md) | The `tasks` module: tables, ordering, the API, starting a session from a task, links, and what the sessions module must add |
| 03 | [The calendar](03-calendar.md) | The `calendar` module: personal events, the Google Calendar connection and sync, and how the month view is composed from three modules |

## Slices

Each slice ships behind the `plan` release flag (one row in
`packages/shared/src/feature-flags/catalog.ts`) and is usable on its own.

1. **Board.** Tasks and goals: tables, CRUD, reorder, the board, the task
   and goal dialogs, the project filter, the rail item and its open
   count. No sessions, no calendar. (02 §1–4, 01 §2–3)
2. **Tasks start sessions.** Start session from a card or the dialog,
   Link existing, the card's session line, the session header's "Back
   to task" chip, and Queued for an offline host. (02 §5–7, 01 §4)
3. **Calendar without Google.** The month view, personal events, task
   due dates and automation occurrences as layers, drag to reschedule.
   (03 §1–3)
4. **Google Calendar.** Connect, incremental sync, the sidebar's sync
   card, Settings → Integrations. (03 §4–6)
5. **Later, not designed here.** Writing back to Google, a task moving
   to Done when its PR merges (needs 0.2), a week view, tasks from
   GitHub Issues or Linear, Plan in Slack (0.4) and on mobile (0.5).

## Open questions for the owner

These change what gets built; each note carries its own smaller ones.

1. **Is Plan 0.3, or is it in the MVP?** The export put it in
   `version1/` and on the MVP console's rail, as it did automations,
   which then moved into the MVP (`../mvp/16-automations-architecture.md`
   Q1). This directory assumes 0.3.
2. **Google Calendar: read-only or two-way?** The frames let you edit
   and drag a Google event like a personal one. Two-way needs the
   `calendar.events` scope (sensitive, longer Google verification) and
   conflict handling; read-only needs `calendar.readonly` and is
   slice 4 as written. Proposed: read-only first, Google events open
   read-only with "Open in Google Calendar". (03 §4)
3. **Do personal events belong in Oppenheimer at all?** The frames have
   a Personal calendar (Dentist, Padel). It is cheap (one table we need
   for Google anyway), but it makes Plan a calendar app as well as a
   board. Proposed: keep it, it is the same row with `source = manual`.
4. **Does anything move a card on its own?** The frames move a card to
   In progress when a session starts from it, and nothing else. Proposed:
   only that in 0.3; Done stays a person's call until 0.2 gives a merged
   PR to key on.
5. **Queued.** The launch dialog says "Queue session" for an offline
   host, and the session waits as Queued. The API already keeps such a
   session `starting` and re-dispatches it on reconnect. Proposed:
   derive Queued (`starting` + host offline) everywhere in the console,
   New session included, not a new stored state. (02 §7)

## Decision log

- 2026-10-05: directory created from the 2026-10-05 export; the 0.3
  sketch points here. The product word is **Plan** for the section,
  **task** and **goal** for the things in it; the 0.3 sketch's "card"
  is a task.
