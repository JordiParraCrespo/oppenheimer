# 13 — Automations: the console

The 2026-09-26 export (`design/version1/Routines.dc.html`, which is
`SessionsConsole` opened on its automations page) and the 2026-09-27
export's editor dialog draw the console's second list. Its copy says
**Automations**; the export's internal names stay `routines`
(`design/README.md`), and the console uses the product word. This note
owns the console: what the export draws and what is built. How a run is
fired, guarded and dispatched is 16; the tables and modules are 10.

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
- **The editor**: a dialog over the console with three steps under its
  title as a segmented strip — Task (the name, what the agent should do),
  Trigger (any trigger starts a run; a row adds one, a schedule or a
  GitHub event, each read as a sentence), Where it runs (Code: project,
  repositories; Runs on: host, agent, model) — and a footer that walks
  them: the line that says what is still missing, Back, Cancel on the
  first step, Next while a step is unfinished, Create on the last.
- **A run** opens the session it started, in the console's session pane.

## Built

| URL | What |
|---|---|
| `/automations` | The overview on its Automations tab: run history, then the table |
| `/automations/runs` | The overview on its Runs tab: run history with its legend, then every run |
| `/automations/$automationId` | One automation: its header, run history and runs |
| `/automations/$automationId/sessions/$sessionId` | A run: the session it started, in the whole pane, with the automations list kept beside it |

- **The list beside the rail is the address's**: everything under
  `/automations` is the automations list, the rest the sessions list. One
  predicate (`useConsoleList`, the kit's) answers the rail's current item
  and the sidebar the shell mounts, which is why a run opens under
  `/automations` and not under `/sessions`.
- **The sidebar** groups the automations by project (the workspace's
  Unassigned project has no group: an automation is set up for a project),
  with a search over names, each row's glyph (a clock, or GitHub's mark
  when an event can start it) and its mono meta — Running, Paused, the wait
  to the next slot, else its run count. The selected automation expands its
  last six runs; each opens the run view.
- **The overview** is one frame, `EditorPage` with its wide body, mounted by
  the layout route; each tab is a route of its own, so the address says
  which is open. The run-history chart is thirty bars of the viewer's local
  days, drawn from the first visit: with no runs yet it is the empty axis,
  not absent (2026-09-28). The table's row menu edits, runs now, pauses or resumes, duplicates
  and deletes. The Runs tab keeps its status pill, facets (automation,
  project, window) and page in the URL; a page is ten runs. The status
  pills and the facets share one row in every locale: a facet caps its
  width and truncates a long name, and when the row still cannot hold
  them the facets wrap as one group, never the window alone. The unset
  facet says "all" in every language (2026-09-29).
- **One automation**: Back, then the ordinary page header (not the large
  one) with Run now, Edit and the more menu (pause or resume, duplicate, delete behind a confirm), the facts
  line (status, the countdown to the next run, the trigger, agent · model ·
  project), the paused band with its reason and Resume, then its run
  history and its runs.
- **The editor** is one dialog for New and Edit automation, opened through
  `useConsoleDialog` from the sidebar, a project header's plus, the
  overview, a row's Edit and a page's Edit. Task holds the two typed
  fields (React Hook Form over the shared Task schema); Trigger draws each
  trigger as a sentence of tokens — a schedule with its week strip and
  next run, a GitHub card with the live "would have run N times" line the
  API replays against received events; Where it runs picks project,
  repositories, host, agent and model, prefilled from the project. Create
  and Save exist only on the last step.
- The feature is `apps/web/src/features/automations/` over the product
  package's `automations` module (`packages/frontend/consumer`).
- Not built: templates (16 decides them as a fixed catalog; they come
  after), and the frame's run transcript beside the terminal, which is
  the headless slice's structured output (16 §5).

## Open

- **What a run opened from the Runs tab of a deleted automation shows.**
  The run view keeps the automations list, where that automation no longer
  has a row; the session opens, and nothing in the list is selected.
