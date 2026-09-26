# 12 — Projects on the console: New session, the project dialog, the grouped sidebar

The 2026-09-26 design export (`design/version1/SessionsConsole.dc.html`)
puts the project on the console. This note works out everything the
product needs for that, from the table to the screen, so the slices
below can be built in order. The design system's side landed first
(`Composer`'s scope band, `RepositoryRowList`, `SidebarProjectHeader`,
`Rail`, the pane rows); this is the rest.

## What the export changed

- **New session is a tabbed composer.** The scope chips — project,
  host, repository, branch — sit in a grey band fused to the top of the
  field, borderless and muted, so where the work happens reads as one
  sentence over the box. The title and the lead stay above it.
- **A project chip, first.** 10 decided the MVP shows no project chip
  because a project had one instance per repository and a fifth chip was
  friction. The export reverses that: a project is now a thing a person
  makes and names, with **default repositories, a default host and a
  default agent**, and picking one prefills the other chips. The chip's
  foot row is **New project…**.
- **The project dialog.** Name; the repository rows (tick to include,
  mark Default to clone into every new session, a base-branch pill per
  row); the default host as chips; the default agent as chips. Cancel,
  Create project (or Save, with Delete project on the left when editing).
- **The sidebar groups sessions under projects**, each header with a
  mono count and hover actions (New session here, Edit project), and a
  rail on the left switches between the sessions and routines lists.
  A session row renames inline, moves to another project ("only projects
  that include *repo* can hold it") or deletes. Out of this note's
  slices except where named below; the row menu and the move are
  recorded so the data model already admits them.

## Decided

### Data model

The project keeps its identity split — a free name over an immutable
slug — and grows what the dialog edits.

- `project` gains `defaultHostId uuid null` (foreign key to `host`,
  `ON DELETE SET NULL`: removing a machine must not take a project with
  it) and `defaultAgent varchar null` (a `CODING_AGENTS` id; null is
  "the composer's last choice").
- **`project_repository`**: `id`, `projectId` (cascade), `installationId`
  (our `github_installation` row, cascade: a disconnected installation
  takes its rows with it), `githubRepoId bigint`, `fullName` (so the
  dialog and the sidebar can print a name without a GitHub call),
  `isDefault boolean`, `baseBranch varchar null` (null is the
  repository's own default branch, read live), `createdAt`. Unique
  `(projectId, githubRepoId)`; index on `installationId`.
- The slug of a project made in the dialog is derived from its **first
  default repository** (else its first repository, else its name), with
  the same three candidates as 11's rule, so the directory can still be
  read back to what named it. `originGithubRepoId` stays **null** on a
  project made in the dialog: the origin is the identity of an
  *auto-created* project ("this repository's project") and the partial
  unique on it must keep answering that question for API callers that
  send checkouts without a project. Two projects may therefore include
  the same repository, which is what the move dialog's "only projects
  that include *repo*" implies.

### API

- `POST /projects` — `{ name, repositories: [{ installationId,
  githubRepoId, isDefault, baseBranch? }], defaultHostId?, defaultAgent? }`.
  Each repository is checked through `RepositoryAccessPort.repositoryOf`
  under the caller's scope (a repository another workspace's installation
  covers is `GITHUB_010`, as on a checkout), the host through
  `HostAccessPort.assertUsable`. A slug collision takes the next
  candidate; the id-suffixed one cannot collide. Scope `projects:write`,
  policy `create` on `Project`.
- `PATCH /projects/{id}` grows the same optional fields; `repositories`
  given replaces the set. Rename alone still works.
- `GET /projects` and `GET /projects/{id}` return `repositories`,
  `defaultHostId` and `defaultAgent` on every row. The console needs the
  rows to fill the chips and the sidebar to group; a second call per
  project would be one request per header.
- `POST /sessions` is unchanged: `projectId` plus at most one checkout.
  The console always sends the project it shows, so the implicit "the
  project is the first checkout's" path is for API callers only.
- Moving a session (`PATCH /sessions/{id}` with `projectId`) and the
  row's rename are the sidebar slice's, not this one's.

### Console

- **New session** keeps its screen, section and composer shape. The
  section reads one more list (`useProjects`) and the composer takes the
  chips through its `scope` slot. The chips, in order: project, host,
  repository, and the branch chip while exactly one repository is
  selected. Each is the design system's `ChipSelect` in its `tab`
  variant; the host chip's Add host… and the repository chip's Manage
  repository access foot rows are unchanged.
- **Picking a project prefills**: host from `defaultHostId` when it is
  set and the host still exists; the repository from the first default
  repository, with its `baseBranch`; the agent from `defaultAgent` with
  that agent's default model. A chip the person then changes stays
  changed for that visit; nothing is written back to the project from
  New session.
- **The project is remembered** with the host, the agent, the model and
  the effort (`localStorage`), and validated against the list once it
  answers. A workspace with one project starts on it. The scope
  (repositories) is still never remembered.
- **New project…** opens the project dialog from the chip's foot row.
  It is `sessions/dialogs/project.tsx`, one dialog owning its mutation:
  the name field over `displayNameSchema`, `RepositoryRowList` over the
  installations' repositories (branches read per ticked row, as the
  picker does), the host chips over the host list, the agent chips over
  the catalog. On success the new project is selected and its defaults
  prefill the chips. The same dialog edits a project later, from the
  sidebar header's action; Delete project is the archive command, and
  the API's "still has open sessions" refusal is what disables it.
- **A session is created with `projectId`** and the repository chip's
  checkout. `SESSIONS_009` cannot happen from the console any more,
  because the project chip has no empty state once the workspace holds a
  project — and a workspace with none is shown the dialog's foot row as
  the way to make one.
- **Where the code goes** (`.agents/rules/frontend-architecture.md`): the
  product package gains `modules/projects` (entity, repository, service)
  and `react/projects.queries.ts`; the console's feature stays
  `sessions/` (a project is the body of work a session belongs to, and
  the dialog is opened from the session composer) until a projects
  screen exists, at which point `features/projects/` takes the dialog.

### The grouped sidebar

- `Rail` left of the sidebar (a `rail` slot on the shell), Sessions current
  with its count; Routines drawn where the export draws it and **disabled**
  with a tooltip saying it is not here yet, until the routines page lands.
- The head reads **Projects** with the count, a New project button (the
  same dialog) and the filter menu, which gains a **Project** facet. Under
  it `SidebarSearch` narrows rows live in the browser (the list is already
  whole), then the active-filter chips.
- One `SidebarProjectHeader` per project, in the order the API lists them,
  its count and two hover actions: **New session here**
  (`/sessions/new?project=<id>`, which starts the composer on that project
  with its defaults) and **Project settings** (the project dialog in edit
  mode: Save, and Delete project, which is the archive and stays disabled
  while the project holds sessions). An empty project shows the empty row
  with a link to start one. A session whose project the list does not hold
  goes last under "Other sessions".
- A row's ellipsis menu: **Rename** (inline, `PATCH /sessions/{id}`),
  **Move to project…** (a pane in the same menu listing the other projects
  that hold the session's repository, `POST /sessions/{id}/move`, one new
  `session.moved` event the row folds), **Delete** (a confirm dialog over
  the close: the session stops, its worktree leaves the host, the row stays
  resolved so the name is never reissued).

### Later slices, in order

1. Routines (the second rail item) and Settings, each their own note.

## Open

- Whether a project with **no repository** is worth allowing from the
  dialog. 10 says "a project with `repos = []` models a project of notes,
  documents and bots"; the API admits it (slug from the name) and the
  dialog does not stop it. The runner still needs a host to put it on.
- The **default agent's model**: the dialog picks an agent, not a model,
  so New session uses that agent's default model. A model per project is
  a later addition if it is wanted.
