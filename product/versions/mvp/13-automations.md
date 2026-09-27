# 13 — Automations: the console's second list, ahead of its API

The 2026-09-26 export (`design/version1/Routines.dc.html`, which is
`SessionsConsole` opened on its automations page) draws the console's
second list. Its copy says **Automations**; the export's internal names
stay `routines` (`design/README.md`), and the console uses the product
word. Automations themselves — the scheduler, the GitHub trigger, the
runs — stay out of the MVP (00); what this note records is the console's
side, built so the rail is whole, and what the export draws for the rest.

## What the export draws

- **The rail's second item** switches the sidebar to the automations
  list: New automation on top, the Projects line with its count, a live
  search, then All automations and a folding header per project — each
  with New automation in it — over the project's automations, a clock or
  the GitHub mark naming the trigger, a mono meta on the right. The
  selected one expands its last runs under it.
- **The overview** in the main column: Automations / Runs as tabs with
  New automation on the right; a run-history bar chart; on Automations,
  the table (trigger in words, next run as clock time and countdown, a
  status dot and word, a row menu) and the templates by category; on
  Runs, the status tabs, the automation filter, the rows and a pager.
- **One automation**: the page header at its large size — glyph, name,
  Run now, Edit, the more menu with pause, duplicate and delete — a
  status line, a paused band, then its run history and its runs.
- **The automation dialog** (New automation, Edit automation) over the
  console, since the 2026-09-27 export: a title and Close, then three
  steps as tabs — **Task** (the name, and "What should the agent do?",
  the instructions for every run, with the pull request, issue or commit
  that fired the run passed in as context), **Trigger** (any trigger
  starts a run: schedule cards with their time grid and next run, GitHub
  events with the matches they would have fired on), and **Where it
  runs** (project, repositories, host). The 2026-09-26 evening export
  drew it as a page over the main column with four numbered steps
  (Where, When, What, Agent); `SessionsConsole (pages)` keeps that
  frame.
- **A run** opens the session it started, in the console's session pane.

## Built (2026-09-26)

| URL | What |
|---|---|
| `/automations` | The overview on its Automations tab: the table, empty |
| `/automations/runs` | The overview on its Runs tab: the runs list, empty |
| `/automations/new` | The editor's header, Back and a Create that stays off; `?project=` is kept for the Where step. Built as a page on 2026-09-26; becomes the automation dialog (2026-09-27), and the route goes |

- Which list is beside the rail is the address's: everything under
  `/automations` is the automations list, and the
  rest is the sessions list. One predicate (`useConsoleList`, the kit's)
  answers both the rail's current item and the sidebar the shell mounts.
- `/automations` is a layout route that mounts the overview's frame once
  — `EditorPage` with its wide body, the view tabs as links, New
  automation — and outlets the tab's view.
- The editor sits under the `_editor` layout, the frame the project page
  and Add a host use — until those three become dialogs (2026-09-27): the
  dialog opens from New automation over whichever list is beside the
  rail, carries the project it was opened from, and has no URL of its
  own.
- The sidebar lists the projects as groups, each empty until an
  automation exists; the search and the rows arrive with them. The
  workspace's Unassigned project has no group, nor does it count: it holds
  the sessions that name no project, and an automation is set up for one
  (2026-09-27).
- The console's feature is `apps/web/src/features/automations/`, on the
  app's allowlist because its pages render no entity yet; the product
  package gains its module when the control plane names the resource.
- Not built, on purpose: a page for one automation, and the dialog's
  steps. A route with an id that no loader can refuse would answer every
  address with an empty page, and numbered steps without a field are a
  facade.

## Open

- **The data model.** A routine is a session template plus a trigger; a
  run is a session the trigger started. Whether a run is a row of its own
  or a session with a `routineId` decides most of the API, and 03, 10
  and 11 own the tables and endpoints when they are decided.
- **Templates.** The export's grid is a fixed catalog by category; whether
  templates are code, rows, or both.
- **Where runs are opened.** The export opens a run in the session pane
  with the sidebar still on automations; the sessions pane assumes the
  sessions list.
