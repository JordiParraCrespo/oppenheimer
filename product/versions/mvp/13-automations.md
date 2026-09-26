# 13 — Automations: the second list, its pages and their routes

The 2026-09-26 export (`design/version1/Routines.dc.html`, which is
`SessionsConsole` opened on its automations page) draws the console's
second list. Its copy says **Automations**; the frames' internal names and
this repo's file names stay `routines` (`design/README.md`). This note
works out the console's side — the list, the pages and their routes —
so the API behind it can be built against a shape that exists.

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
- **The editor**: the page over the main column, like the project page:
  a page header whose title is the name, Cancel and Create, a recap line,
  then four numbered steps — Where (project, repositories, host), When
  (trigger cards), What (the task), Agent (agent, model, permission,
  effort).
- **A run** opens the session it started, in the console's session pane.

## Decided

### Routes (built 2026-09-26)

| URL | What |
|---|---|
| `/automations` | The overview on its Automations tab |
| `/automations/runs` | The overview on its Runs tab |
| `/automations/{id}` | One automation |
| `/automations/new` | The editor; `?project=` is where the sidebar opened it from |
| `/automations/{id}/edit` | The editor on an existing automation |

- `/automations` is a layout route under `_authenticated` that declares
  `list: 'automations'`, which is what swaps the sidebar for the
  automations list; the rail's two items are links, and the one under
  the address is current.
- The editor pages sit under the `_editor` layout, the frame the project
  page and Add a host already use; the overview and the automation page
  fill `OverviewPage`, the wider frame the export gives a table.
- The console's feature is `routines/` (a module of the product package,
  `modules/routines`, whose entity is the shape above); a run that opens
  is the session it started, so it is `sessions/`' pane.

### What is built, and what waits

The frame, the routes and the way between them are built: the sidebar's
list with the projects as its groups, the overview's tabs and its empty
table and runs list, the automation page's address, the editor's header
and its four steps by name. Everything that needs an automation to exist
— the rows, the run history, the templates, the editor's fields and its
save, the automation page's header and runs — waits for the API, which
is this note's next slice: the `routine` and `routine_run` tables, the
scheduler, the GitHub trigger, and the endpoints the pages read.

## Open

- **The data model.** A routine is a session template plus a trigger; a
  run is a session the trigger started. Whether a run is a row of its own
  or a session with a `routineId` decides most of the API.
- **Templates.** The export's grid is a fixed catalog by category; whether
  templates are code, rows, or both.
- **Where runs are opened.** The export opens a run in the session pane
  with the sidebar still on automations; the sessions pane assumes the
  sessions list.
