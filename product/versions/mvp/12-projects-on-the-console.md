# 12 — Projects on the console: New session, the project page, the grouped sidebar

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
- **The project page.** A dialog in the morning export; the evening
  export of the same day made it a page over the main column, built like
  the automation editor: a page header whose title is the name, Cancel and
  Create project (or Save changes) on its right, a recap line under it;
  then three numbered steps — the repository rows (tick to include, mark
  Default to clone into every new session, a base-branch pill per row),
  the default host as chips, the default agent as chips — each ticking
  itself done with a summary. Editing adds a Delete project row at the
  foot, behind a confirm. Save is off until the project has a name, at
  least one repository and at least one default.
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
- Moving a session and the row's rename are the sidebar's: the route,
  the event and what it leaves alone are 03's; the chrome is 05's.

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
- **New project…** opens the project page from the chip's foot row
  (`/projects/new`). It is `features/projects/screens/project.tsx`, one
  screen owning its mutations: the name as the page header's title input
  over `displayNameSchema`, `RepositoryRowList` over the installations'
  repositories (branches read per ticked row, as the picker does), the
  host chips over the host list, the agent chips over the catalog. On
  success it lands on New session with the project in the address
  (`?project=`), so the chip selects it and its defaults prefill the
  rest. The same page edits a project later (`/projects/{id}`), from the
  sidebar header's action; Delete project is the archive command behind
  a confirm dialog, and the API's "still has open sessions" refusal is
  what disables it.
- **A session is created with `projectId`** and the repository chip's
  checkout. `SESSIONS_009` cannot happen from the console any more,
  because the project chip has no empty state once the workspace holds a
  project — and a workspace with none is shown the dialog's foot row as
  the way to make one.
- **Where the code goes** (`.agents/rules/frontend-architecture.md`): the
  product package gains `modules/projects` (entity, repository, service)
  and `react/projects.queries.ts`; the console gains `features/projects/`
  for the page and its delete confirm, since the page is a screen a route
  mounts. The chips and their prefill stay in `sessions/`, which is what
  they belong to.

### The grouped sidebar

Built after New session, and specified where the rest of the console is:
the rail, the grouped list, the head, the search, the header actions, the
row menu and `?project=` are 05's sidebar bullet; the move route,
`session.moved`, `SESSIONS_018` and the slug the host's paths keep are 03's.
This note stays the projects-on-New-session note.

### Later slices, in order

1. Routines (the second rail item) and Settings, each their own note.

## Decided since

- A project with **no repository** cannot be made from the console: the
  2026-09-26 evening export's page keeps Save off until at least one
  repository is ticked and one is default. The API still admits an empty
  set (slug from the name), for callers that model a project of notes,
  documents and bots as 10 describes (2026-09-26).

## Open

- The **default agent's model**: the page picks an agent, not a model,
  so New session uses that agent's default model. A model per project is
  a later addition if it is wanted.
