# 12 — Projects: the backend

The 2026-09-26 design export ([`design/`](design/README.md)) changed what a
project is, and this note designs the control plane that change needs: the
schema, the aggregates, the commands, the endpoints, the errors, the wire
change and the order to build it in.

It supersedes the **Projects** parts of
[`10-api-modules-and-data-model.md`](10-api-modules-and-data-model.md)
("`projects/`" under *Seven new tables*, the project half of the endpoint
surface, and the "the MVP never shows a project chip" argument). Everything
else in 10 stands: the tenancy mechanism, the slug-is-a-directory rule, the
tombstones, the composite keys and archiving failing closed.

## What the design changed

In the export's `SessionsConsole` artboard (the seed `PROJECT_SEED`, the
*New project* / *Project settings* dialog, the *Move* dialog and the sidebar):

1. **A project is a saved scope a person creates.** The frame's own comment:
   "the repos a session may clone, the base each one branches from, and the
   defaults a new session starts with". It is created from the sidebar's
   *New project…* and from the composer's project chip, not as a side effect
   of the first session on a repository.
2. **A project holds several repositories**, each with a base branch and a
   *default* flag ("2 of 3 by default"). **A repository can sit in more than
   one project**; a session belongs to exactly one.
3. **A project carries defaults**: a host, an agent, and free-text
   **instructions** ("Run pnpm test before every commit…").
4. **Picking a project re-seeds the composer**: the default repositories
   ticked, each on its base, the project's host and agent, the agent's first
   model.
5. **The sidebar groups sessions by project**, with filters by project,
   repository, agent and host and a sort (last activity, oldest, name).
6. **A session can be moved to another project**, but "only projects that
   include *its repository* can hold it. Its branch and worktree stay where
   they are."
7. **A project can be deleted only when empty**: "Move or delete its N
   sessions first".
8. **Routines are grouped by project** and take their repositories from it.
   Routines are their own note; this one only says what they will need from
   projects ([below](#what-routines-will-need)).

## What the code has today

`apps/api/src/projects/` (built from 10): a `project` row per GitHub
repository, **auto-created** by the first session on it
(`ProjectLookupPort.ensureForRepository`), found again by
`originGithubRepoId` (partial unique per workspace), a slug derived from the
repository name that is immutable because it is a directory on every host,
`PATCH /projects/{id}` for the name, and `DELETE /projects/{id}` to archive,
which refuses while the project has unresolved sessions and fails closed
when nothing answers that question (`ProjectUsagePort`). There is no
`POST /projects`; `packages/shared/src/schemas/project.schema.ts` says so in
its header.

The disk layout and the branch both name the project:

```
workspaces/<organization.slug>/projects/<project.slug>/repos/<store>.git
workspaces/<organization.slug>/projects/<project.slug>/sessions/<session.slug>/<checkout>
branch  oppenheimer/<project.slug>/<session.slug>
```

`session.create` on the link carries `projectSlug`, and the runner builds the
path from it (`packages/shared/src/protocol/messages.ts`,
`apps/runner/internal/link/protocol.go`).

That last fact is what makes item 6 hard: if moving a session changed its
project slug, the next `session.restart` would look for the worktree in a
directory it is not in.

## Decided

### A project is created on purpose; auto-creation is the API's fallback only

`POST /projects` exists. The console always creates projects explicitly and
always sends `projectId` on `POST /sessions`.

`ensureForRepository` **stays**, for callers that do not name a project (an
API token or an MCP client that only knows a repository), and what it creates
changes: a project named after the repository, holding that one repository
as its default, on the repository's default branch. `originGithubRepoId`
keeps its partial unique index and its meaning, "the project this API created
for this repository", which is still what makes the auto-create race-safe.
It does **not** mean "the project this repository is in" any more: a
repository can be in several projects, and only one of them can be its
auto-created one. Without `projectId` the lookup is by origin, never by
"the one project that happens to contain it", because that answer changes
when somebody edits an unrelated project.

The console's empty account ("No project" in the frame) creates its first
project in the dialog before its first session. The API does not invent one
behind it.

### The repositories a project holds are rows: `project_repository`

```
project_repository
  id                  uuid pk
  organizationId      uuid        not null
  projectId           uuid        not null
  installationId      uuid        not null
  githubRepoId        bigint      not null
  repositoryFullName  varchar     not null   display snapshot, refreshed on every write
  baseBranch          varchar     not null
  isDefault           boolean     not null
  position            smallint    not null   the order the dialog shows
  createdAt, updatedAt timestamptz

  fk (organizationId, projectId)      → project (organizationId, id)             on delete cascade
  fk (organizationId, installationId) → github_installation (organizationId, id)
  unique (projectId, githubRepoId)
  index  (organizationId, githubRepoId)       "which projects include this repository" (Move, routines)
```

- **A child of the `Project` aggregate**, like `session_checkout` is of
  `WorkSession`: no resource declaration, never queried outside
  `projects/database/`, always read by an already-scoped `projectId`. The
  composite keys make "a project holding another workspace's installation"
  unrepresentable, as they do for checkouts.
- **This is configuration, not history**, so a removed repository is a
  **deleted row**, not a `removedAt`. The never-hard-delete rule in 10 exists
  for directory names and for logs; a project's repository list is neither.
  A session keeps what it checked out on its own `session_checkout` rows, so
  editing a project never reaches into a running session.
- **Still no repository table.** This is the second place a repository is
  remembered by id, installation and a name snapshot, after
  `session_checkout`, and it is remembered because a person chose it, which
  the live listing cannot say.
- **Validated live on every write.** `PATCH`/`POST` resolve each repository
  through `RepositoryAccessPort` (the `github/` module's one export), which
  refreshes the snapshot name and refuses one the installation no longer
  covers. A repository that leaves the installation later changes nothing
  here: the next session's token mint fails, as it does today.
- **Invariants on the aggregate**: at least one repository, at least one
  default, at most 20 repositories, a non-empty base per repository. They
  are the dialog's save-blocking rules (`projSaveBlocked`), held server side.

### The defaults and the instructions are columns on `project`

```
project  (existing)  + createdByUserId  uuid null     audit; never on delete cascade
                     + defaultHostId    uuid null     fk host(id) on delete set null
                     + defaultAgent     varchar null  a CODING_AGENTS id
                     + instructions     text not null default ''   ≤ 8 000 characters
```

- **A default is a suggestion, never a grant.** `host` is person-owned (10);
  `project` is workspace-owned. `defaultHostId` does not let anyone use a
  host: `POST /sessions` still loads the host through the own-or-grant
  scoped `HostRepository` and refuses on a miss, exactly as today. On read,
  the project reports the default host only when the caller can see it and
  it is not unpaired; otherwise `null`. Writing a default host the caller
  cannot see is refused at write (`HOSTS_001`), so the column only ever holds
  a host somebody could use when it was set.
- **`defaultAgent`** is validated against `CODING_AGENTS` by the Zod schema,
  the same enum `POST /sessions` uses. Whether the host's runner can start it
  is still answered at session create (`SESSIONS_011`). The model is not
  stored: the frame applies the harness's first model, and a pinned model
  per project is a list that goes stale on a harness bump.
- **Instructions are snapshotted onto the session** at create, into a new
  `work_session.instructions` text column beside the launch columns, and
  travel on `session.create` ([below](#the-wire-one-optional-field)). Editing
  a project's instructions changes the next session, never a running one, and
  a restart relaunches with what the session was launched with, which is the
  same reason the launch options are folded onto the row (2026-09-21).

### The slug is still a directory, derived once, from the name

A project a person creates has no repository to take its slug from, so the
slug is derived from the **name** at creation and never again, with the
same shape of deterministic candidate list 10 uses:

1. `<name>` sanitised (`PROJECT_SLUG_PATTERN`, 60 characters);
2. `<name>-<first 8 hex of the project's UUID>`.

The UUID is minted before the insert, so the second candidate is derived
from the row itself and cannot collide in practice; a unique violation on it
is a 500, not a retry loop. Auto-created projects keep the repository-derived
candidates they have today. `slug` stays immutable and `name` free, and a
renamed project keeps the directory of its first name, as 10 already
accepted.

### A session's project is a label; its directory is its home

Moving a session must not move anything on disk, and the design says so.
So the session carries two project references:

```
work_session  + homeProjectId  uuid not null   immutable: the directory the tree is in
                 projectId      uuid not null   mutable:   the project it is listed under
```

- `homeProjectId` is set once, at create, equal to `projectId`. It is what
  every runner command that names a path uses: `session.create`,
  `session.restart`, the close and the checkout commands send
  `projectSlug = home.slug`. The runner and the wire do not change.
- The branch was already stored per checkout (`session_checkout.branch`), so
  it needs nothing: it keeps the home project's slug in its name for ever,
  as the frame promises ("its branch and worktree stay where they are").
- **The session slug's uniqueness moves to the directory it names**:
  `unique (projectId, slug)` becomes `unique (homeProjectId, slug)`. The old
  constraint would make a move fail on a slug that happens to exist in the
  target, which is not a directory conflict at all.
- Both columns carry the composite key `(organizationId, …) → project
  (organizationId, id)`, so neither can point into another workspace.
- **Considered and left: a flat layout.** Dropping the project level from
  disk (`workspaces/<org>/repos/`, `workspaces/<org>/sessions/`) would make
  a project pure metadata, share one bare store per repository across
  projects and make the slug free. It is the cleaner end state, and it is a
  protocol change, a runner change and a migration of trees already on
  hosts. The home column costs one column and no wire change; the flat
  layout can still be adopted later, because `homeProjectId` is exactly the
  fact a migration of old trees would need to find them.

### Moving a session is a command with its own rules

`POST /sessions/{id}/move` `{ projectId }` → `MoveSessionCommand`, in
`sessions/`, because the session is the aggregate that changes.

It refuses when:

- the session is resolved (`SESSIONS_005`);
- the target is missing or in another workspace (`PROJECTS_001`) or archived
  (`SESSIONS_006`), through the existing `requireActiveProject`;
- the target does not include **every live checkout's repository**
  (`SESSIONS_018`, new). This is the frame's rule, and it is what makes a
  project's repository list mean something: a project's routines and filters
  can trust that every session in it works on one of its repositories. A
  session with no checkouts can move anywhere.

`ProjectLookupPort` gains `includesRepositories(scope, projectId,
githubRepoIds): Promise<boolean>`, so `sessions/` asks rather than reading
`project_repository`.

A move is recorded in the log as an `api` event, `session.moved { from, to
}`, and `projectId` is folded from it, like the name is. The fold stays the
one writer of the row, and the history of where a session was listed
survives a replay. Moving to the current project is a no-op that writes
nothing.

**Creating a session does not require its repository to be in the
project.** The frame lists such a repository in the chip as "not in
project" and lets it be picked. So a session can be created somewhere the
move rule would not let it be moved to; that asymmetry is the frame's, and
it is harmless, because the rule is about *moving* work under a scope that
did not choose it.

### Deleting a project is archiving it, and only when it is empty

`DELETE /projects/{id}` keeps its meaning (archive, `archivedAt`, no
un-archive, slug tombstoned) and its refusal (`PROJECTS_005` while an
unresolved session is **listed** in it; `PROJECTS_003` when nothing answers).
The frame's "Move or delete its N sessions first" is that refusal.

A session that was **homed** in the project and moved out does not block the
archive: its tree stays in the archived project's directory, and nothing is
lost, because the slug is never reissued and the session's commands still
find the home by id. Archiving never touches disk.

`project_repository` rows are kept with the archived project; they are what
the archived project was.

### The endpoint surface

```
GET    /projects                 read Project    projects:read    + repositories[], defaults, instructions
GET    /projects/{id}            read Project    projects:read
POST   /projects                 create Project  projects:write   new
PATCH  /projects/{id}            update Project  projects:write   name, instructions, defaults, repositories (whole set)
DELETE /projects/{id}            update Project  projects:write   archive (unchanged)

POST   /sessions/{id}/move       update Session  sessions:write   new; body { projectId }
GET    /sessions                 read Session    sessions:read    + githubRepoId, agent, sort filters
```

The scope catalog already grants `create Project` under `projects:write`
(`packages/shared/src/scopes/catalog.ts`). The two new routes need their
rows in `packages/shared/src/permissions/endpoint-policies.ts`
(`POST /projects` → `create Project`, `POST /sessions/{id}/move` →
`update Session`), and `SYSTEM_ROLE_PERMISSIONS` needs checking for
`create Project` on the owner role; nothing else in the authorization model
changes.

```ts
// packages/shared/src/schemas/project.schema.ts
projectRepositoryInputSchema = z.object({
  installationId: z.string().uuid(),
  githubRepoId:   githubRepoIdSchema,
  baseBranch:     gitRefSchema,
  isDefault:      z.boolean(),
});

createProjectSchema = z.object({
  name:           displayNameSchema,
  repositories:   z.array(projectRepositoryInputSchema).min(1).max(20)
                    .refine(some isDefault).refine(unique githubRepoId),
  defaultHostId:  z.string().uuid().nullable().optional(),
  defaultAgent:   codingAgentSchema.nullable().optional(),
  instructions:   z.string().max(8000).optional(),
});

updateProjectSchema = createProjectSchema.partial();   // name-only callers keep working
```

- **The repositories are replaced as a set**, in the order given
  (`position`). The dialog saves everything at once, and a set replace inside
  one transaction on the project row is the one write that cannot leave a
  project with no default between two calls. Per-repository routes would
  need the invariants to hold after each of them.
- **`GET /projects` embeds the repositories** (at most 20 each) and does not
  count sessions. The sidebar already holds the session list it groups, and
  a count from the API would need `projects/` to ask `sessions/` per row.
- **`GET /sessions`** gains `githubRepoId` (a join to live checkouts),
  `agent` and `sort` (`recent` = `lastEventAt desc`, `oldest` = `createdAt
  asc`, `name`). The group itself stays computed on read, as today.
- The response DTO adds `homeProjectId` to the session and `repositories`,
  `defaultHost`, `defaultAgent`, `instructions` to the project; then
  `pnpm generate:api-client`.

### The wire: one optional field

`session.create` (and the restart that replays it) gains
`instructions?: string`, at most 8 000 characters. The runner hands it to the
agent the way the catalog entry for that agent says, as data beside
`command` and the permission levels — Claude Code's
`--append-system-prompt` is the expected shape — and **the catalog strings
are read off each CLI's own `--help` at implementation time**, the rule the
launch options already follow. An agent whose CLI has no such option (the
blank terminal, and any the probe finds without one) gets the instructions
written to a file outside the worktree whose path the runner reports in
`session.step`, never into the repository, where it would be committed.

Optional, so a runner that predates it ignores it and the session still
starts. No protocol version bump.

### Errors

| Code | Title | HTTP |
|---|---|---|
| `PROJECTS_006` | A project needs at least one repository | 400 |
| `PROJECTS_007` | A project needs a default repository | 400 |
| `PROJECTS_008` | That repository is not available to this workspace | 409 |
| `SESSIONS_018` | That project does not include this session's repository | 409 |

`PROJECTS_006`/`007` duplicate the Zod refinements on purpose: the aggregate
holds its invariants whatever the caller, the schema only gives a console
the early message. Each needs its row in `apps/docs/docs/errors.md`.

### The migration

One migration, in this order, each step lock-safe on tables this size:

1. `project`: add `createdByUserId`, `defaultHostId` (fk `on delete set
   null`), `defaultAgent`, `instructions default ''`.
2. Create `project_repository` with its keys and indexes.
3. **Backfill** one row per existing auto-created project from its origin:
   `githubRepoId = originGithubRepoId`, `isDefault = true`, and the
   installation, name snapshot and base branch from the most recent
   `session_checkout` of that repository in that workspace. A project with
   no checkout to read them from gets no row and is shown with no
   repositories until someone edits it; the invariant is enforced on write,
   not assumed on read.
4. `work_session`: add `homeProjectId`, backfill it from `projectId`, set
   `not null`, add its composite key; add `instructions text null`.
5. Swap `unique (projectId, slug)` for `unique (homeProjectId, slug)`
   (create the new one first, then drop the old).

### What routines will need

Routines are designed in their own note. From projects they need exactly
three things, and this design already provides them:

- a routine belongs to one project (`(organizationId, projectId)` composite
  key) and picks a subset of its repositories, which the
  `(organizationId, githubRepoId)` index on `project_repository` answers;
- archiving a project must refuse while it holds active routines, which is
  a second contribution to `ProjectUsagePort` from the routines module —
  the port was built for exactly one more answerer;
- every run is an ordinary session created in the routine's project with
  the project's instructions, so nothing in this note changes for them.

## Build order

Each step lands alone and keeps the console working.

1. **Shared**: the project schemas, `codingAgentSchema` reused for `defaultAgent`,
   `SESSIONS_018` and the `PROJECTS_006–008` rows, the optional
   `instructions` on `session.create` (and its Go struct).
2. **Migration** and the ORM entities, with the backfill.
3. **`projects/`**: `ProjectRepositoryEntity` inside the aggregate,
   `CreateProjectCommand`, the widened `UpdateProjectCommand`, the name-based
   slug candidates, `includesRepositories` on the lookup port, the new
   response DTO; `ensureForRepository` creates the one-repository project.
4. **`sessions/`**: `homeProjectId` everywhere a path is built,
   `MoveSessionCommand` and `session.moved` in the fold, the instructions
   snapshot on create, the new list filters.
5. **Runner**: deliver `instructions` per catalog entry.
6. **Console**: the project dialog, the project chip and its re-seeding, the
   sidebar grouped by project, Move. (05 gains the project chip; 00's
   "four chips" becomes five.)

## Open questions

1. **Several repositories per session.** The frame ticks every default
   repository of a project; 2026-09-23 made a session one repository until
   the runner makes several worktrees (11's R3). Until then the console
   ticks the project's **first** default repository and `POST /sessions`
   keeps `SESSIONS_010`. The project model above already holds several, so
   nothing here changes when R3 lands.
2. **Project order in the sidebar.** The frame shows seed order. This note
   orders by `createdAt`; a `position` on `project` is one column if people
   want to drag them.
3. **"The transcript is gone."** The frame's delete-session copy says so,
   and today close keeps the row and the log (they are tombstones, 10).
   Whether the event payloads are purged on close, and after how long, is a
   retention decision for the sessions note, not a projects one.
4. **The flat layout** above, when the runner next changes its layout for
   another reason.
