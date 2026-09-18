# 09 — API: modules and data model

The in-depth version of [`03-control-plane.md`](03-control-plane.md)'s
"Data model, first cut". That note named the modules and listed the
tables; this one decides the module boundaries, the aggregates, the
schema, the on-disk layout they describe, and the endpoint surface —
against the contract `apps/api` actually enforces
(`apps/api/ARCHITECTURE.md`, `scripts/check-api-structure.mjs`,
`apps/api/.dependency-cruiser.cjs`).

Scope: the control plane only. The runner's internals are
[`02-runner.md`](02-runner.md); the console is
[`05-screens.md`](05-screens.md). They appear here as the counterparties
whose contract the API serves.

## The nouns, placed

| The noun | Where it lives | New? |
|---|---|---|
| **Organizations** (name, url, members) | the Better Auth `organization` + `member` tables, unchanged | no |
| **Hosts** | `hosts/` → `host` (keys inline), `host_pairing_token` | yes |
| **Projects** | `projects/` → `project` | yes |
| **Sessions** | `sessions/` → `work_session`, `session_checkout`, `work_session_event` | yes |
| **Repositories** | `github/` → `github_repository` | yes |
| **GitHub allowed repositories** | *the same table* — the installation is the allowlist | — |
| **Coding agents** | a closed catalog in `packages/shared`, plus per-host availability on `host.capabilities` | no table |
| **Models** | no table, no column — a field on the shared catalog entry and on the session's launch spec | no table |

Two of these resolve to "not a table" and one to "the same table as
another noun". Each is argued below; none is an oversight.

## Decided

### A project holds sessions; a session holds checkouts

This is the shape the whole design turns on, so it comes first.

- A **project** is a body of work — "XRP Mobile". It is the unit a
  person thinks in, and it outlives any session in it. Later it also
  holds agents and documents ([the layout](#the-layout-on-a-host)).
- A **session** is one piece of work inside a project: a terminal, an
  agent, and a set of checkouts.
- A **checkout** is one repository, checked out for one session, on its
  own branch. A session has one or more.

A project is **not** a repository, and a session is **not** a
repository. Sessions belong to projects, and repositories are what a
session takes from GitHub — which is why the session's branch lives on
the checkout and not on the session.

Orca, the closest product to this one, has no multi-repository
workspace at all: its nearest escape hatch is a "folder workspace" that
abandons git entirely (no branch, no diff, no source control). So this
part has no reference implementation to copy and is ours to get right.

### Five new modules, none named after a lifecycle stage

```
apps/api/src/
  hosts/      the machines that answer to a workspace
  github/     what GitHub grants this workspace, and how we exercise it
  projects/   the bodies of work, and the names their directories take
  sessions/   a session, its checkouts, its event log, and attaching
  relay/      the live connection plane — no table, no aggregate
```

`organizations/` is **not touched**. The `organization` row already is
the personal workspace ([`08-auth.md`](08-auth.md)), and `AGENTS.md`
says that module is not an example to copy.

**Tenant scoping, precisely.** Every table that is reachable on its own
— `host`, `host_pairing_token`, `github_installation`,
`github_repository`, `project`, `work_session` — carries
`organizationId`, declares a resource with `defineResource`, and uses a
repository extending `ScopedRepositoryBase`, so the SQL predicate and
the CASL condition are generated from one declaration (F24).

`session_checkout` and `work_session_event` carry **no**
`organizationId` and declare **no** resource, on purpose: they are
inside the `WorkSession` aggregate and are reachable only through it.
`applyAccessScope` writes its predicate as
`${alias}.${keys.organization}` against the **query's root table** and
never traverses a join
(`packages/backend/authz/src/scope/apply-access-scope.ts`), so a child
table with no such column cannot be scoped by that mechanism at all —
declaring the dimension without the column would be a resource that
scopes nothing. The rule that replaces it: **these two ORM entities are
never queried outside `sessions/database/`, and every read loads the
organization-scoped `work_session` first, then reads children by the
already-verified `sessionId`.** `GET /sessions/{id}/events` follows that
path rather than querying the event table directly. Stating this
matters because the generic mechanism silently does not apply here, and
a handler that assumed it did would be scoping nothing.

**`hosts/`** owns which machines this workspace has paired, how we prove
a connecting process is one of them, what each machine can run, and
whether it is reachable now. Pairing lives here because a registration
token is host identity *before the host exists*. Aggregates:
`HostEntity` (the host, its current key and the previous one still
inside its rotation window — a host must never be left with zero valid
keys, which is why the pair lives on the aggregate rather than a child
table) and `HostPairingTokenEntity`.

**`github/`** owns which App installations belong to the workspace,
which repositories they cover, and how to turn that into a one-hour
token narrowed to one repository. One aggregate,
`GithubInstallationEntity`, holding the installation *and its repository
set*, because that set is replaced as a whole by every
`installation_repositories` webhook. The vendor name stops at the
directory: the CASL subjects are `Installation` and `Repository`, the
scope resource is `repositories`, and no Octokit type leaves
`infrastructure/`.

**`projects/`** owns the bodies of work and — load-bearing — **the
names their directories take**. `project.slug` is a directory name on
every host, so its uniqueness is a database constraint rather than a
convention two runner versions could implement differently. It is a
thin module today, deliberately: it grows to own the project's agents
and documents, which are the next things inside that directory.

**`sessions/`** owns what a session is, what it checked out, what
happened to it, what state that implies, and who may open a terminal on
it. `WorkSessionEntity` holds its event log and its checkouts inside
the aggregate, because the state invariant is `state = fold(events)`
and a checkout written outside the aggregate could leave the session
pointing at a working directory that does not exist.

**`relay/`** owns which host is attached to which API process right now,
and how bytes reach it. No table, no aggregate — the same shape as the
existing `outbox/`, `throttling/` and `capabilities/` modules. That is
precisely why it is its own module and not a folder inside `sessions/`:
it is the only knowledge in the design that does not live in Postgres.
It holds no policy — it authenticates by asking `hosts/`, authorises
attach by asking `sessions/`, and records facts by dispatching a
command.

`relay/` is not temporal decomposition. `session-create`,
`session-relay` and `token-minter` as three modules would be; grouping
by knowledge owned is what rules them out.

### The layout on a host

```
~/oppenheimer-ai/
│
├── projects/
│   └── xrp-mobile/                        ← project.slug
│       │
│       ├── repos/                         ← bare stores. Nobody works here.
│       │   ├── acme--xrp-mobile.git/
│       │   └── acme--design-system.git/
│       │
│       ├── sessions/
│       │   ├── fix-login-3f9a/            ← work_session.slug
│       │   │   ├── .oppenheimer           ← provenance marker
│       │   │   ├── xrp-mobile/            ← checkout, the agent's cwd
│       │   │   └── design-system/         ← second checkout, a sibling
│       │   └── add-swaps-b210/
│       │       └── xrp-mobile/
│       │
│       ├── agents/                        ← later
│       └── docs/                          ← later
│
└── accounts/                              ← later (note 06)
```

This replaces [`11-workspace-layout.md`](../../11-workspace-layout.md)
§1. Four differences, each with a reason:

1. **`projects/`, not `workspaces/`.** "Workspace" already means the
   `organization` row in this API. Two meanings for one word is a bug
   generator.
2. **No `main/` level.** It existed only so `worktrees/` could sit
   beside it inside the repo folder. Worktrees now live under
   `sessions/`, so `repos/<name>.git/` *is* the store.
3. **The store is bare.** On this repo `.git` is 41 MB and the working
   tree 67 MB, so bare saves the larger half per repository per
   project, and makes "never edited" structurally true instead of a
   rule in a document. `git worktree add` works from a bare repo.
   One gotcha: `git clone --bare` sets no fetch refspec, so the runner
   must add `+refs/heads/*:refs/remotes/origin/*` or `git fetch` will
   not update remote-tracking refs.
4. **`repos/` and `sessions/` are peers, never nested.** A worktree
   inside its own repository means `git status` sees it and IDE file
   watchers recurse into it.

**Two naming rules**, and only one of them needs a row:

| Level | Rule | Why |
|---|---|---|
| `repos/<owner>--<repo>.git` | **always** owner-prefixed | Derived from `fullName`, which GitHub guarantees unique, so a collision is impossible and no database row is needed |
| `sessions/<slug>/<dir>` | `<repo>`, or `<owner>--<repo>` if taken *in this session* | A set of two or three the API controls at create time; held by `uq (sessionId, directoryName)` |

Paths are then fully derived, every segment a unique-constrained column:

```
store     projects/{project.slug}/repos/{owner}--{repo}.git
checkout  projects/{project.slug}/sessions/{work_session.slug}/{session_checkout.directoryName}
```

### Worktree when we can, clone when we cannot

A checkout records **which it got**, because cleanup differs: a worktree
needs `git worktree remove` and a prune; a clone is a directory removal.
Guessing from the filesystem is how dangling git metadata accumulates.

Worktree is the default and matters for the product's feel: it needs no
network and no token, so a terminal can appear before GitHub is
involved. A clone is the fallback — no store yet, a git too old, or a
repository that genuinely wants isolation.

### Four rules learned from Orca, which this design would otherwise get wrong

Read out of `stablyai/orca` (MIT), the most mature product in this
space.

1. **Identity is never a path.** Orca's `worktreeId` is
   `${repoId}::${absolutePath}`, and a folder rename silently mints a
   different workspace — so they carry four parallel indexes to undo
   it, and their own conclusion is "mint an opaque instance id on day
   one and treat the path as a mutable attribute". Every table here
   uses a UUID primary key and derives the path.
2. **Ownership is proven by metadata, never by where a directory
   sits.** A person can run `git worktree add` by hand inside
   `~/oppenheimer-ai/`. Orca: *"path shape alone is not authority."*
   So the runner writes `.oppenheimer` into each session directory at
   creation, **before** any setup runs, and removes only directories
   carrying it. [`02-runner.md`](02-runner.md)'s "kills orphans after a
   grace period" is qualified by this, or it deletes a person's work.
3. **Ownership and visibility are different axes.** Importing a foreign
   worktree may make it visible; it never makes it ours to delete.
   Orca calls collapsing the two "the single most dangerous
   simplification available here".
4. **A session's directory name is never reused.** Claude Code and
   Codex key conversation state by working directory, so a new session
   landing on a retired name inherits a stranger's history — a bug that
   is near-impossible to diagnose from the symptom. Here this is free
   *provided* `work_session` rows are **never hard-deleted**: closing
   sets `stoppedAt`, the row remains, and `uq (projectId, slug)` is a
   permanent tombstone. That is a rule, not an accident.

Orca also gates a new name on four things before committing to it —
retired names, a local branch, a remote branch, and an existing pull
request claiming that branch. Checking directory existence alone leaves
you creating a session whose branch already has an open PR.

### Events are the source of truth; the row is the fold

`work_session_event` is append-only and is the truth per session
([`03-control-plane.md`](03-control-plane.md)). `work_session.state` is
a **projection**, not a second truth:

- `WorkSessionEntity` has no `setState`. The only mutator is
  `recordEvent(e)`, which runs the pure fold in
  `domain/session-state.policy.ts` and advances `stateSeq`.
- `seq` is assigned by the **control plane** under a row lock on
  `work_session`, not by the runner, so a buggy or hostile host cannot
  create gaps or regress the log. The writer's own idempotency key
  (`<epoch>:<n>` from the runner, the command id from the API) is
  `UNIQUE (sessionId, idempotencyKey)`, so a replayed batch after a
  dropped ack is skipped, not re-applied.
- The append and the fold happen in **one transaction**, so the sidebar
  is never eventually-consistent with its own log.

A replay of the log rebuilds the column at any time, which is the test
that it is genuinely derived.

### Credentials are rows only when they must be revocable

- **The pairing token is a row**, because F5 demands revocation, an
  expiry and a source IP — three things you can only act on if they
  persist. Burning it is one atomic statement:
  `UPDATE … WHERE tokenHash = $1 AND redeemedAt IS NULL AND
  revokedAt IS NULL AND expiresAt > now() RETURNING …`. **The
  `revokedAt IS NULL` term is load-bearing**: `DELETE /hosts/pairing/{id}`
  sets that column and nothing else, so without it F5's "revocable"
  is a column nobody reads and a revoked token still pairs a host.
  Zero rows is the only failure, and it
  does not distinguish used, expired and forged, on purpose. Only the
  SHA-256 is stored.
- **The attach ticket is not**, because nothing about it is revocable:
  it expires in thirty seconds, faster than anyone could revoke it.
- **Installation access tokens are not rows at all.** Minted on demand
  from the App key in the secret store, cached in Redis until shortly
  before expiry. F20 and F23 become structural facts rather than rules
  someone has to remember.

### The runner makes exactly one HTTP call, ever

`POST /hosts/pairing/redeem`, from the install command, before the host
has a key to authenticate with. Everything after — reconciliation, event
append, token delivery and rotation, session start and stop, PTY bytes —
rides the single outbound WebSocket, as [`00-scope.md`](00-scope.md)
decided ("the runner holds one outbound WebSocket") and
[`08-auth.md`](08-auth.md) decided for the token specifically ("hands it
to the runner over the relay"). Job payloads are sealed to the host's
public key, which is F7 met rather than avoided.

**A finding worth recording either way.** If a runner HTTP route is ever
added, the host's boot assertion must **not** travel in
`Authorization: Bearer`. `ScopesGuard` is registered globally as an
`APP_GUARD` and calls `CredentialScopeResolver.resolve()` on every HTTP
route; that resolver treats any bearer value that is neither an
`oppenheimer_pat_…` token nor a recognised OAuth grant nor a Better Auth
session as a forgery and throws `INVALID_CREDENTIAL`
(`apps/api/src/auth/application/credential-scope.resolver.ts`,
`rejectUnlessSession`). A host JWT presented that way would 401 before
any route-level guard ran. It needs its own header, or the resolver
needs to be taught the host credential kind.

### The two "not a table" decisions

**Models.** No table, no column, no endpoint. A model is a launch option
of an agent, and [`07-mvp.md`](../../07-mvp.md) says a model picker is
explicitly a later idea — the New session screen has four chips and none
is a model. The seam is an optional `model` in the session's launch
spec, recorded in the log; because the log is the source of truth,
promoting it to a column later is a replay, not a backfill of data we
never captured.

Orca's own source is the argument here. Its agent spec carries
`modelSource: 'static' | 'dynamic'` and a `modelDiscovery.parse(stdout)`
**function**, with the comment: *"empty so a failed probe degrades to
the catalog seed instead of a second model list here that can drift from
it."* A parse function is not a column.

**Coding agents.** No table either. The catalog is a closed union plus a
config record in `packages/shared`, exactly as Orca keeps its 36 agents
(`src/shared/tui-agent.ts`: *"Extend this union as new agents are
added"*). Entries carry `promptInjectionMode`, `preflightTrust` and
launch commands — behaviour, not data — so a row would be a second,
driftable source of truth for something that needs runner code anyway.
The dynamic half, whether *this machine* has `claude` on PATH, is a host
fact on `host.capabilities`. No vendor credential ever reaches the
platform (F23).

**Repositories and "GitHub allowed repositories" are one noun.**
`github_repository` rows *are* the allowlist, because the App
installation is a boundary GitHub enforces server-side and the
`installation_repositories` webhook keeps our copy current. A second
table could only be a subset of a boundary we do not own, would drift on
every webhook, and would invent the failure mode "the repo is in our
allowlist but the token mint fails". The cheaper seam for a
per-workspace filter is a nullable `hiddenAt` column.

### The schema follows Better Auth's own shape

The starter's identity tables are the reference, because they are the
tables this codebase already reads every request. Four rules, read off
`apps/api/src/auth/database/`:

1. **Rows are flat.** Situational state is a nullable column, never a
   satellite table. `session` carries `delegated`,
   `delegatedCredentialId`, `impersonatedBy`, `activeOrganizationId` and
   `activeTeamId` on one row.
2. **Credentials sit inline with the thing they authenticate.**
   `account` holds `password`, `accessToken`, `refreshToken`, `idToken`
   and four expiries on the provider-link row.
3. **A short-lived token gets its own table, shared across kinds.**
   `verification` is `identifier` + `value` + `expiresAt`, serving email
   verification, password reset and magic links alike.
4. **A table earns its place by independent lifetime**, not by being a
   different noun.

Applied honestly, those rules delete three tables an earlier draft had:
a `host_key` table (rule 2), an `attach_ticket` table (rule 4 — it
cannot outlive the thirty seconds it is valid for), and a
`github_webhook_delivery` table (the handler is a full resync, so it is
already idempotent).

Uniform across all eight: `id` uuid primary key minted with
`randomUUID()`, `@CreateDateColumn`/`@UpdateDateColumn`, snake_case name
(the convention `api_token`, `user_role`, `access_grant` and
`user_settings` already follow), and an `organizationId` for the tenant
scope, exactly as `lead` does.

### Eight new tables

**`hosts/`**

- `host` — `id`, `organizationId`, `pairedByUserId`, `name`, `hostname`,
  `os`, `arch`, `runnerVersion`, `capabilities` jsonb (git/tmux/disk and
  the detected agents), `publicKey` text, `publicKeyFingerprint`,
  `previousPublicKey` text null, `previousPublicKeyExpiresAt` null,
  `lastSeenAt`, `connectionEpoch` bigint, `connectedReplicaId`,
  `unpairedAt`, timestamps. Index `(organizationId)`; unique
  `(publicKeyFingerprint)`.

  **The key is a column, not a table**, per rule 2 and the `account`
  precedent. Rotation (F8) needs the old key valid for a grace window,
  which is *two* keys, never N. This also takes a join off the hottest
  path in the system: every runner boot verifies an assertion against
  this row.

- `host_pairing_token` — `id`, `organizationId`, `createdByUserId`,
  `intendedName`, `prefix`, `tokenHash` unique, `createdFromIp` inet,
  `redeemedFromIp` inet, `expiresAt`, `revokedAt`, `redeemedAt`,
  `redeemedHostId`. F5's "source IP shown" is two columns, not one.

  **This one stays a table**, and Better Auth is the reason: it is
  `verification`. A token minted before its subject exists cannot be a
  column on that subject, and most rows never become a host.

  `intendedName` comes from Orca's Add-remote-server dialog, which names
  the machine *before* it exists ("Dev box"). The console posts a name,
  the token carries it, and the host adopts it at registration instead
  of defaulting to a hostname you then have to rename.

**`github/`**

- `github_installation` — `id`, `organizationId`, `githubInstallationId`
  bigint unique, `accountLogin`, `accountType`, `repositorySelection`
  (`all` | `selected`), `installedByUserId`, `suspendedAt`, `syncedAt`,
  `deletedAt`, timestamps. Index `(organizationId)`.
- `github_repository` — `id`, `installationId`, `organizationId`
  (**denormalised** from the installation), `githubRepoId` bigint,
  `fullName`, `owner`, `name`, `defaultBranch`, `isPrivate`,
  `isArchived`, `hiddenAt`, `syncedAt`, timestamps.
  Unique `(installationId, githubRepoId)`; index
  `(organizationId, fullName)` — the repo chip is one index scan with no
  join, which is why `organizationId` is copied down. A repository never
  moves workspace (you disconnect and reconnect instead), so the copy is
  an invariant, not a sync.

No `github_webhook_delivery` table. Every delivery triggers a **full
resync** of that installation's repository set, which is idempotent by
construction and immune to `added`/`removed` arriving out of order, so
de-duplication only saves a redundant GitHub call — a Redis key with a
24-hour TTL is the right weight.

**`projects/`**

- `project` — `id`, `organizationId`, `name`, `slug`, `archivedAt`,
  timestamps. Unique `(organizationId, slug)`.

  **Both come from the GitHub repository name.** Auto-created on the
  first session for a repository: `slug` is the sanitised repository
  name, `name` starts as the same thing. The MVP never shows a project
  chip — `00-scope.md` decided four chips, and a fifth is real friction
  on the most-used screen for a concept with one instance.

  **`slug` is immutable; `name` is free.** The slug is a directory name
  on every host, so a rename that changed it would have to move
  `projects/<old>/` on every machine holding the project, with live
  sessions inside it. Splitting them makes renaming display-only and
  free. This is the same lesson as rule 1 below: a path is never an
  identity. The cost is that a project's directory keeps its first
  repository's name for ever, so `projects/xrp-mobile/` can hold a
  project called something else — cheap against moving directories
  under running sessions.

**`sessions/`**

- `work_session` — `id` (UUID v4, unguessable per F25, and also the tmux
  session name), `organizationId`, `projectId`, `createdByUserId`,
  `hostId`, `name`, `slug`, `agent`, `cwdCheckoutId` null, then the
  fold: `state`, `stateSeq`, `agentSessionId`, `lastEventAt`,
  `stoppedAt`, timestamps.
  Index `(organizationId, state, createdAt DESC)` for the sidebar;
  `(projectId, state)`; `(hostId, state)` for runner reconciliation;
  unique `(projectId, slug)`; unique `(id, cwdCheckoutId)` is not
  needed, but the composite foreign key below is.

  `cwdCheckoutId` is **where the agent is launched** — the one fact that
  matters — encoded directly instead of through a flag on a checkout.
  Set, and the agent starts inside that checkout with the others as
  `../siblings`; null, and it starts in the session directory with every
  checkout a peer. A boolean on the checkout row could only express the
  first. Its foreign key is composite —
  `FOREIGN KEY (id, cwdCheckoutId) REFERENCES session_checkout
  (sessionId, id) ON DELETE SET NULL` — so naming another session's
  checkout is unrepresentable, and removing the checkout the agent was
  in degrades to the session root rather than dangling.

  **Rows are never hard-deleted.** Closing sets `stoppedAt`. See rule 4
  above: `uq (projectId, slug)` is the tombstone that stops a new
  session inheriting a retired session's agent conversation state.

- `session_checkout` — `id`, `sessionId`, `repositoryId`,
  `directoryName`, `mode` (`worktree` | `clone`), `baseBranch`,
  `branch`, `createdBy` (the provenance marker), `worktreeCreatedAt`,
  `pushedAt`, `createdAt`.
  Unique `(sessionId, repositoryId)`, `(sessionId, directoryName)` and
  `(sessionId, id)` — the last so the composite key above can reference
  it.

- `work_session_event` — `id`, `sessionId`, `seq`, `idempotencyKey`,
  `source` (`runner` | `api`), `kind`, `payload` jsonb, `occurredAt`,
  `recordedAt`. Unique `(sessionId, seq)` and unique
  `(sessionId, idempotencyKey)`. Every read is by session, so no other
  index is needed.

No `attach_ticket` table — a Redis key, `attach:<random>` →
`{sessionId, organizationId, window, userId}`, with a **60-second** TTL
doing the expiry.

**Decided, and the transport is the part that matters.** The ticket
travels in `Sec-WebSocket-Protocol`, never in the query string. A
browser cannot set headers on a WebSocket but it can set a subprotocol,
which is the standard idiom for exactly this. The query string is the
one weakness here that leaks *permanently*: reverse proxies, CDNs and
load balancers log request lines by default, and
`.agents/rules/` already says never to log query strings "because they
routinely carry session cookies, bearer tokens" — a rule applied to
pino and then bypassed by the layer above it. Thirty seconds is short;
a log line is forever, and this ticket buys an interactive shell.

**Sixty seconds, not thirty.** Single use is the real control, so the
lifetime should buy reliability rather than shave a risk that is already
bounded to one attach. Mint → DNS → TLS → upgrade on a cold radio can
take five to ten seconds, and the failure mode of being too tight is
"the terminal did not open" on precisely the device this product exists
for.

**One ticket, one attach**, consumed atomically. Every reconnect mints a
fresh one. **And the relay re-checks at consume**: the session is still
live, and the user is still a member of the owning workspace. Without
that, authorization is frozen at mint — stop the session, remove the
person from the workspace or revoke their credential inside the window
and they still get a PTY. The relay must load the session anyway to
find the host, so the check is nearly free. **This
costs one new primitive, and that is the honest trade.** `CacheService`
today is `get`/`set`/`del`/`reset`, and `get`-then-`del` is a race two
relay connections could both win. Single use needs an atomic
read-and-delete, so the abstraction gains `take<T>(key)` over Redis's
`GETDEL`. A few lines and a reusable primitive, but a change to a shared
package. If that is unwanted, the fallback is the table, where
`UPDATE … WHERE consumedAt IS NULL RETURNING` is atomic with no new
tooling. The table is the safer choice; Redis is the better-engineered
one. Either way the durable record is an `attach.opened` entry in the
session log.

There is no `jobs` table. The desired state is already the session row,
and the outbox is already a durable queue.

### The endpoint surface

Console-facing, all `/api/v1`, all with `@CheckPolicies` +
`@RequireScopes` + Swagger decorators:

```
GET    /hosts                     read Host          hosts:read
GET    /hosts/{id}                read Host          hosts:read
PATCH  /hosts/{id}                update Host        hosts:write
DELETE /hosts/{id}                delete Host        hosts:write
POST   /hosts/pairing             create Host        hosts:write   body: { name }
GET    /hosts/pairing             read Host          hosts:read    (F5: source IP)
GET    /hosts/pairing/{id}        read Host          hosts:read    → redeemedHostId
DELETE /hosts/pairing/{id}        delete Host        hosts:write

GET    /repositories              read Repository    repositories:read
GET    /repositories/{id}/branches read Repository   repositories:read
GET    /installations             read Installation  repositories:read
POST   /installations             create Installation repositories:write
POST   /installations/{id}/sync   update Installation repositories:write
DELETE /installations/{id}        delete Installation repositories:write

GET    /projects                  read Project       projects:read
GET    /projects/{id}             read Project       projects:read
PATCH  /projects/{id}             update Project     projects:write

GET    /sessions                  read Session       sessions:read
GET    /sessions/{id}             read Session       sessions:read
POST   /sessions                  create Session     sessions:write
PATCH  /sessions/{id}             update Session     sessions:write
POST   /sessions/{id}/stop        update Session     sessions:write
POST   /sessions/{id}/restart     update Session     sessions:write
DELETE /sessions/{id}             delete Session     sessions:write
GET    /sessions/{id}/events      read Session       sessions:read
POST   /sessions/{id}/attach-ticket  attach Session  sessions:write
POST   /sessions/{id}/checkouts   update Session     sessions:write
DELETE /sessions/{id}/checkouts/{checkoutId}  update Session  sessions:write
```

`attach` is a **distinct CASL action**, so a read-only credential can
list sessions without opening a PTY on one (`leads`' `export` action is
the precedent). `restart` is required by
[`02-runner.md`](02-runner.md): a host reboot shows every session as
stopped with a Restart button that recreates window 0 in the same
worktree. `POST /sessions/{id}/checkouts` exists because adding a
repository to a *running* session is the shape Claude Code on the web
already has, and confining it to the create screen would be a needless
limit.

`POST /sessions/{id}/attach-ticket` returns `{ticket, url, expiresAt,
window, hint}`; the client presents `ticket` as a WebSocket subprotocol,
not a query parameter. `window` because tabs are tmux windows, so a ticket
authorises one window; `hint` because
[`01-protocol.md`](01-protocol.md) decided tickets can carry structured
hints (`host-offline`, `runner-update-required`).

Unauthenticated by design, and therefore carrying no `@RequireScopes`:

```
POST /hosts/pairing/redeem   credential = the registration token, checked in the handler
POST /github/webhook         credential = X-Hub-Signature-256 over the raw body
GET  /relay/attach            credential = the single-use ticket in Sec-WebSocket-Protocol,
                              never the query string; Origin checked (F2)
```

Each carries `@NoPolicy('<reason>')` rather than no decorator at all:
`PoliciesGuard` fails closed, and
`apps/api/src/auth/__tests__/route-policy-coverage.spec.ts` turns a
missing declaration into a build failure. The exemption returns before
the `request.user` check, so it is the intended way to model a route
with no principal.

Not HTTP at all: the runner uplink (`GET /relay/runner`, WebSocket, host
assertion) and everything it carries.

The install command and the agent install prompt are served from
`POST /hosts/pairing`'s response, templated from deploy-owned runner
release config (version, URLs, SHA-256 checksums) — not from a database
column. A workspace-writable launch or install string would be remote
code execution on a host.

### What changes outside `apps/api`

1. `packages/shared/src/scopes/catalog.ts` — `SCOPE_RESOURCES` grows
   from 11 to 15 with `hosts`, `projects`, `sessions`, `repositories`,
   each with a `PERMISSION_GROUPS` entry naming the CASL policies that
   back it, so `grantableScopes` can still refuse a token with more
   reach than its creator.
2. `packages/shared/src/agents/catalog.ts` — the coding-agent catalog,
   imported by the console through a narrow subpath.
3. Zod schemas for the session, checkout, project and host shapes, which
   nothing validates today.
4. **The owner role, in two places that must agree.** A data migration
   granting the org-scoped `owner` role `manage` on `Host`, `Project`,
   `Session`, `Installation` and `Repository` within
   `${activeOrganizationId}`, **and bumping `organization.roleVersion`**
   so cached abilities refresh. Precisely: `ScopeResolver` itself caches
   nothing ("Nothing here is cached", `authz/application/scope.resolver.ts`)
   because team membership is written by Better Auth outside any app
   transaction — but *role rules* are cached keyed on
   `organization.roleVersion`, which is what the bump invalidates, and
   `UserRoleRepository` is what writes it. And the same entries
   added to `SYSTEM_ROLE_PERMISSIONS.owner` in
   `packages/shared/src/permissions/abilities.ts`, because the seed
   writes roles from that constant and `AddOwnerRole` says the migration
   mirrors it. The migration fixes existing databases; the constant
   fixes freshly seeded ones. Miss either and a workspace owner is
   refused from every new route — and both are invisible to any test
   that stubs the ability.
5. `pnpm generate:api-client`, plus a changeset. Three consumers
   regenerate: `packages/frontend/consumer` (which drops its hand-rolled
   DTOs), `apps/cli/src/lib/api-types.ts`, and `apps/mcp/src/tools/`.

### What changes in the committed client contract

The console's hand-rolled `SessionDto` is a stub with a comment saying
it switches to the generated SDK once these endpoints exist, and both
screens are empty states — so this is the moment to change it, and the
cost only grows.

```ts
interface SessionDto {
  id; name; hostId; projectId; agent; state; createdAt;
  cwdCheckoutId: string | null;
  checkouts: {
    id; repository; directoryName;
    mode: 'worktree' | 'clone';
    baseBranch; branch;
  }[];
}
```

`repository`, `baseBranch` and `branch` leave the session, because with
several checkouts they are per-checkout facts. `SessionState` gains
**`blocked`**: [`00-scope.md`](00-scope.md) names the sidebar dot's
three states as working, blocked and idle, and the design system's
`StatusState` already carries `needs-input`. Without it the one feature
the dot exists for is unrepresentable.

The mapping is still not complete, and that is open question 6:
[`02-runner.md`](02-runner.md) has the screen manifest classify a pane
as `working, blocked, done, idle, unknown`, and adding `blocked` maps
three of those five.

The status line changes with it: with N checkouts there is no single
repository, so it shows the cwd checkout's `repo · branch` plus a count.

## Build order

Each step is a vertical slice that can land alone.

1. `packages/shared`: the four scope resources, the five subjects, the
   agent catalog, the Zod schemas, and the `SYSTEM_ROLE_PERMISSIONS`
   entries.
2. `github/` — installations, the repository cache, the webhook, the
   repo chip. It goes first because it is the only module that can be
   built and tested end to end against a real App installation with no
   WebSocket surface in existence, and because nothing else can resolve
   a repository without it.
3. `hosts/`, starting with `mint-host-pairing-token` and
   `redeem-host-pairing` — the smallest slice that exercises a new scope
   resource, a new CASL resource, a scoped repository, a single-use
   credential and a public route at once.
4. `projects/` — one aggregate, auto-creation, and the slug constraint.
5. `sessions/` — the row, the checkouts, the log and the fold, with no
   relay: create, list, stop, events.
6. `relay/` — the runner uplink and the browser attach, which turns the
   step-one spike ([`06-step-one-spike.md`](06-step-one-spike.md)) into
   the real path.

## Decided since the first draft

- **F5's source IP needs `TRUST_PROXY` set.** The mechanism already
  exists and is correctly defaulted: `app.config.ts` takes a hop count,
  `main.ts` leaves Express's `trust proxy` off at `0` so "a direct
  client cannot spoof `X-Forwarded-For`". The consequence is that at the
  default, `createdFromIp` and `redeemedFromIp` record *the proxy*. The
  control plane sits behind public HTTPS
  ([`03-control-plane.md`](03-control-plane.md)), so `TRUST_PROXY` must
  be set to the real number of hops or F5's "source IP shown" is a
  column full of one address. A deployment requirement, not a design
  question.

- **The App is configured with "request user authorization during
  installation", and that is not optional.** `POST /installations` must
  prove the caller can see the installation it is claiming, or a forged
  `installation_id` hands them one-hour tokens to another account's
  repositories. The proof is to exchange the OAuth `code` GitHub
  attaches to the same redirect, call `GET /user/installations`, verify,
  and discard the code. There is **no fallback**: matching
  `account.login` against the caller's linked GitHub accounts fails for
  organization installations, where that login is the org, not a user —
  so it would either refuse every org install or reopen the hole.

- **A second workspace cannot claim an installation**, because
  `githubInstallationId` is globally unique. The only open part was the
  error, which is `INSTALLATION_ALREADY_CONNECTED` 409 rather than a
  constraint violation surfacing as a 500.

- **The host boot assertion lives 60 seconds and its `jti` is burned.**
  Five minutes was proposed with no replay cache. A captured assertion
  cannot *read* anything — job payloads are sealed to the host key
  (F7) — but it can open an uplink and **inject events into a session's
  log**, which is the source of truth. Redis is already a dependency, so
  a `SETNX jti` with a 60-second TTL at uplink accept closes it for a
  few lines. The connection epoch fence bounds a replay's lifetime but
  does not prevent the injection, so it is not a substitute.

## Open questions

1. **What do `done` and `unknown` become?** The screen manifest
   classifies a pane five ways; `blocked` maps three of them. Does
   `done` collapse into `idle`, or does the sidebar want to distinguish
   "the agent finished" from "the agent is waiting"? The design system
   already carries a `completed` value that nothing produces.
2. **Does `stop` mean "close"?** [`00-scope.md`](00-scope.md) defines
   closing as push the branch and remove the worktree. With `restart`
   now present for host reboots, `stop` probably means "leave it on
   disk" and `DELETE` means close — but the client's verb wants
   confirming before the SDK is generated.
