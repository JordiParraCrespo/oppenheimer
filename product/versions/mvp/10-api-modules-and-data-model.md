# 10 — API: modules and data model

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
| **Hosts** | `hosts/` → `host` (keys inline; owned by a **person**, borrowed by workspaces), `host_pairing_token` | yes |
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
  own branch. A session has **zero or more**: zero is a real session
  working in `sessions/<slug>/` with no git at all, which is what a
  project of notes, documents and bots needs. herdr-projects models the
  same case as a thread of kind `tab`, and a project with `repos = []`
  is ordinary there.

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
  hosts/      the machines a person owns, and workspaces borrow
  github/     what GitHub grants this workspace, and how we exercise it
  projects/   the bodies of work, and the names their directories take
  sessions/   a session, its checkouts, its event log, and attaching
  relay/      the live connection plane — no table, no aggregate
```

`organizations/` is **not touched**. The `organization` row already is
the personal workspace ([`08-auth.md`](08-auth.md)), and `AGENTS.md`
says that module is not an example to copy.

**Scoping, precisely.** Four tables are tenant-owned —
`github_installation`, `github_repository`, `project`, `work_session` —
and carry `organizationId`, declare a resource with `defineResource`,
and use a repository extending `ScopedRepositoryBase`, so the SQL
predicate and the CASL condition are generated from one declaration
(F24). Two tables are **person-owned** — `host` and
`host_pairing_token` — and carry `ownerUserId` / `createdByUserId` and
no `organizationId`: their resources declare `keys: { owner, id }` with
no `organization` key, and `applyAccessScope` then skips the tenant
block and scopes by `own` or `grant` alone
(`packages/backend/authz/src/scope/apply-access-scope.ts`, the
`keys.organization` guard). A supported shape of the kernel, not a
workaround.

`session_checkout` and `work_session_event` declare **no** resource, on
purpose: they are inside the `WorkSession` aggregate and are reachable
only through it. `applyAccessScope` writes its predicate as
`${alias}.${keys.organization}` against the **query's root table** and
never traverses a join, so a child table cannot be scoped by that
mechanism at all — declaring the dimension on it would be a resource
that scopes nothing. `session_checkout` does carry `organizationId`,
but only so the composite foreign keys below can hold; it is not a
scoping column. The rule that replaces the mechanism: **these two ORM
entities are never queried outside `sessions/database/`, and every read
loads the organization-scoped `work_session` first, then reads children
by the already-verified `sessionId`.** `GET /sessions/{id}/events`
follows that path rather than querying the event table directly.
Stating this matters because the generic mechanism silently does not
apply here, and a handler that assumed it did would be scoping nothing.

**`hosts/`** owns which machines a person has paired, how we prove a
connecting process is one of them, what each machine can run, and
whether it is reachable now.

**A host belongs to a person, and workspaces borrow it.** An earlier
draft gave `host` an `organizationId` as the tenant boundary and
`ownerUserId` as the owner. That is one column too many, and the Better
Auth reference says so: the tables that describe a person's *devices
and logins* — `session`, `account`, `passkey`, `two_factor` — hang off
`user`, never off `organization`. A laptop is that kind of thing. The
case that decides it is one person with a personal workspace and a
company workspace on one machine. With a per-workspace host the same
laptop is paired twice, runs two runner processes with two keys, and
the second install has to invent a second `~/oppenheimer-ai`. With a
per-person host it is paired once, and a session names a host its
creator owns or has a grant on, whichever workspace the session is in.
So `host` carries `ownerUserId` and no `organizationId`; `HostResource`
declares `keys: { owner: 'ownerUserId', id: 'id' }` with `'own'` and
`'grant'` among its scopes, as `leads` declares `'own'`, and sharing a
host with a teammate is an `access_grant` over `Host`, which the kernel
already supports. The tenant boundary is not lost, it moves down one
level: `work_session.organizationId` scopes *what runs* on a host, and
the on-disk layout gains a workspace level so two workspaces on one
machine never share a `projects/` tree. The question this raised — the
machine has one Claude login, whose is it? — is answered under
[One login per machine](#one-login-per-machine-and-why-that-settles-whose-the-host-is).
Pairing lives here because a registration token is host identity
*before the host exists*. Aggregates: `HostEntity` (the host, its
current key and the previous one still inside its rotation window — a
host must never be left with zero valid keys, which is why the pair
lives on the aggregate rather than a child table) and
`HostPairingTokenEntity`.

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
├── workspaces/
│   └── jordi/                             ← organization.slug
│       └── projects/
│           └── xrp-mobile/                ← project.slug
│               │
│               ├── repos/                 ← bare stores. Nobody works here.
│               │   ├── acme--xrp-mobile.git/
│               │   └── acme--design-system.git/
│               │
│               ├── sessions/
│               │   ├── bold-otter-3f9a7k/     ← work_session.slug
│               │   │   ├── .oppenheimer       ← provenance marker
│               │   │   ├── xrp-mobile/        ← checkout, the agent's cwd
│               │   │   └── design-system/     ← second checkout, a sibling
│               │   └── quiet-heron-b210c4/
│               │       └── xrp-mobile/
│               │
│               ├── agents/                ← later
│               └── docs/                  ← later
│
└── accounts/                              ← later (note 06): the person's, not a workspace's
```

This replaces [`11-workspace-layout.md`](../../11-workspace-layout.md)
§1. Five differences, each with a reason:

1. **A workspace level, because the host is the person's.** One machine
   serves every workspace its owner is in, and `project.slug` is unique
   per workspace, so two workspaces could each own a `xrp-mobile`.
   `workspaces/<organization.slug>/` keeps them apart, and the word is
   now used for the thing it means in this API — the `organization`
   row. `organization.slug` is globally unique
   (`apps/api/src/auth/database/`), the console exposes no way to change
   it, and the teams slice must keep that or switch the directory to
   the id: a slug rename would move a tree with live sessions in it.
   `accounts/` sits beside `workspaces/`, not inside one, because a
   login is the person's (note 06).
2. **`projects/`, not `workspaces/`, for the bodies of work.** The word
   is taken, by the level above.
3. **No `main/` level.** It existed only so `worktrees/` could sit
   beside it inside the repo folder. Worktrees now live under
   `sessions/`, so `repos/<name>.git/` *is* the store.
4. **The store is bare.** On this repo `.git` is 41 MB and the working
   tree 67 MB, so bare saves the larger half per repository per
   project, and makes "never edited" structurally true instead of a
   rule in a document. `git worktree add` works from a bare repo.
   One gotcha: `git clone --bare` sets no fetch refspec, so the runner
   must add `+refs/heads/*:refs/remotes/origin/*` or `git fetch` will
   not update remote-tracking refs.
5. **`repos/` and `sessions/` are peers, never nested.** A worktree
   inside its own repository means `git status` sees it and IDE file
   watchers recurse into it.

**Three naming rules**, and every one of them is a column:

| Level | Rule | Why a column |
|---|---|---|
| `workspaces/<slug>` | `organization.slug` | already unique, already immutable in practice |
| `repos/<name>.git` | `github_repository.storeDirectoryName`, set **once** to `<owner>--<repo>.git` when the row is first created | a worktree's `.git` file points at its store by absolute path, so the store can never move; deriving the name from `fullName` would move it on every GitHub rename. Unique `(organizationId, storeDirectoryName)`; a later repository that wants a taken name gets a suffix |
| `sessions/<slug>/<dir>` | `<repo>`, or `<owner>--<repo>` if taken *in this session* | a set of two or three the API controls at create time; held by `uq (sessionId, directoryName)`, and never reused inside a session |

Paths are then fully derived, every segment a unique-constrained column:

```
store     workspaces/{organization.slug}/projects/{project.slug}/repos/{github_repository.storeDirectoryName}
checkout  workspaces/{organization.slug}/projects/{project.slug}/sessions/{work_session.slug}/{session_checkout.directoryName}
```

### Worktree when we can, clone when we cannot

A checkout records **which it got**, because cleanup differs: a worktree
needs `git worktree remove` and a prune; a clone is a directory removal.
Guessing from the filesystem is how dangling git metadata accumulates.

Worktree is the default and matters for the product's feel: it needs no
network and no token, so a terminal can appear before GitHub is
involved. A clone is the fallback — no store yet, a git too old, or a
repository that genuinely wants isolation.

### Each checkout picks its base branch; the working branch is always the session's

The repository chip selects **several** repositories, and for each one
a **base branch**. That is `session_checkout.baseBranch`, defaulting to
the repository's `defaultBranch`, and `GET /repositories/{id}/branches`
is what fills the picker. The checkout's own branch is always
`oppenheimer/<project.slug>/<work_session.slug>`, created from the
base — never the base itself. Three reasons, one of them hard: git
refuses to add a worktree on a branch another worktree already has
checked out, so two sessions "on `main`" would fail at the second; the
ids-in-branch rule below is what makes branches collision-free, and it
only holds if the branch is ours; and an agent pushing straight to
`main` is what the pull-request flow in
[`05-github-experience.md`](../../05-github-experience.md) exists to
avoid. [`00-scope.md`](00-scope.md) open question 3 asked exactly this
("base for a new session-named branch, or check out an existing branch
directly? Both?") and the answer is the first, only. Working directly
on an existing branch is a later option, and when it comes it is a flag
on the checkout, not a change to the session.

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
  create gaps or regress the log. The writer's own idempotency key is
  `UNIQUE (sessionId, idempotencyKey)`: from the runner it is
  `<runId>:<n>`, where `runId` is a random id the runner mints at
  process start and `n` its own counter, so the key depends on nothing
  the control plane hands out and survives any reconnect; from the API
  it is the command id. The append is one
  `INSERT … ON CONFLICT (sessionId, idempotencyKey) DO NOTHING` per
  row, with `seq` assigned to the rows that actually land, so a batch
  replayed after a dropped ack, or half-applied before a crash, appends
  only what was not yet seen and the fold runs over exactly that.
- `payload` is capped at 8 KB and **never carries pane text**. The
  screen manifest reports a *state*; PTY bytes go to the browser and
  the runner's ring buffer, never to Postgres (F12).
- The append and the fold happen in **one transaction**, so the sidebar
  is never eventually-consistent with its own log.

A replay of the log rebuilds the column at any time, which is the test
that it is genuinely derived.

### Three state vocabularies, not one

Read out of `eliasstravik/herdr-projects` (MIT), which runs the same
shape — a project of threads, each a worktree and a branch. It keeps
**three** vocabularies where an earlier draft of this note tried to keep
one, and that conflation was the reason `done` and `unknown` had nowhere
to go.

| Layer | Values | Where it lives |
|---|---|---|
| **Stored lifecycle** | `starting`, `open`, `failed`, `resolved` | `work_session.state`, the fold of the event log |
| **Agent observation** | `working`, `blocked`, `idle`, `done`, `unknown` | the screen manifest ([`02-runner.md`](02-runner.md)), reported as events; never a session state |
| **Derived group** | `working`, `waiting-on-you`, `ready-for-review`, `landing`, `idle`, `resolved` | computed on read; what the sidebar dot shows |

`done` and `unknown` are **inputs**, not states. `done` folds in with
`idle` as "ready for a prompt"; `unknown` counts as not-ready and is
what makes a launch look stuck. Mapping them onto `SessionState` was the
error.

The group is organised by **what needs you**, which is what a sidebar is
for:

- **`waiting-on-you`** has four sources, not one: the session failed; the
  agent has been `blocked` for ≥ 30 s; a launch has sat in a non-ready
  state for ≥ 60 s; or the pane is gone with no report.
- **`landing`** is the phase after the agent stops — branch pushed, PR
  open and approved, not yet merged. Nothing else in this design names
  it, and it is what open question 2 was really about.
- **`ready-for-review` versus `idle`** is not a state at all, it is a
  hash comparison: a report exists and `reportHash != ackedReportHash`.
  "Finished and you have not looked" needs no read-receipt table.

Two rules that are easy to get wrong and both load-bearing:

1. **Debounce is measured from a recorded transition, never a live
   probe.** `stateSeconds` is non-zero only when the observed state
   equals the last recorded one, so a caller with no history cannot
   fabricate "blocked for five minutes" and move a healthy session into
   `waiting-on-you`.
2. **Precedence order is a different function from display order.**
   "Blocked for 30 s beats an approved PR" is a correctness rule;
   "ready-for-review sorts first" is a UI rule. Conflate them and
   neither can change.

### Branch names carry the session id

```
oppenheimer/<project.slug>/<work_session.slug>
```

Both segments are unique-constrained (`uq (organizationId, slug)` and
`uq (projectId, slug)`), so a branch name is **self-identifying and
collision-free by construction**. Two sessions can never want the same
branch of the same repository, which is what three independent reviewers
flagged as unconstrained — and it needs no partial index, no pre-flight
check against GitHub, and no race. herdr-projects does the same thing
(`hp/<project>/<thread-id>-<title>`) for the same reason.

### A session is named by its first message; its slug is minted first

`slug` is minted at create — `<adjective>-<noun>-<6 base36>`, the shape
Claude Code on the web gives its branches (`claude/amazing-clarke-p631o4`)
— because the directory and the branch must exist before anything has
been typed, and a directory name is never reused (rule 4 above), so a
name-derived slug would have to be right the first time. `name` starts
equal to the slug and is **derived from the first prompt**: the runner
reads the first user message from the agent's own transcript — Claude
Code keeps one under `~/.claude/projects/`, keyed by working directory;
Codex under `~/.codex/sessions/` — never by scraping the PTY, and
reports it as a `prompt.first` event carrying at most its first 2 KB.
The `name-session` command in `sessions/` then asks a fast model for a
title of at most six words: one call on `@anthropic-ai/sdk` to
`claude-haiku-4-5` with a few dozen `max_tokens`, behind a
`SessionNamerPort` in `sessions/infrastructure/` with two adapters, the
Anthropic one and a no-op one used when `ANTHROPIC_API_KEY` is unset —
the abstract-class-plus-factory pattern `packages/backend/email` already
follows. The result is a `session.named` event, and `PATCH
/sessions/{id}` can overwrite it at any time. A failed or absent call
leaves the slug as the name, which reads fine ("bold-otter-3f9a7k") and
costs nothing. Reading the transcript is the posture note 06 already
takes with the CLIs' usage files: the runner reads what the CLI writes
and sends one line of it; the transcript never leaves the host. The one
line that does leave is the person's own prompt, sent to Anthropic's
API under the platform's key — a sentence for the privacy note, and the
reason a deployment with no key simply names nothing.

### One login per machine, and why that settles whose the host is

Claude Code and Codex hold **one login per configuration directory**,
not one per machine, and neither limits how many sessions run at once:
each session is its own process in its own working directory, and the
CLIs key conversation state by that directory (rule 4). What is single
is the credential — `~/.claude` holds one account, `~/.codex/auth.json`
holds one. Three products handle that the same way, and
[`06-multi-account.md`](../../06-multi-account.md) verified the first:

- **Claude Code** scopes its credential to `CLAUDE_CONFIG_DIR` — on
  macOS the Keychain item is keyed to the config dir since 2.1.144 —
  so two directories are two logins on one machine, and a session
  picks one with an environment variable in its own shell.
- **Orca** does exactly that: one runtime home per account, launched
  with the variable set, nothing global changed.
- **OpenClaw** keeps an auth-profile store per provider with several
  profile ids, gives each of its agents its own `agentDir`, and its
  docs note that reusing the Claude CLI's login expects the OpenClaw
  process to run on the same host as that login — which is our
  situation by construction, since the runner *is* on the host.

So "I can be logged in with just one at once" is true per directory
and false per machine, and the design for several is the **accounts
slice** of note 06: an account is a login in a directory the person ran
once, bound to a host and a human, chosen per session. The MVP does not
build it. In the MVP a host has exactly the login its owner already has
in `~/.claude`, and every session on that host spends it — which is
right *because the host is the person's*: the login and the machine are
on the same axis, and nothing a workspace does can change which account
a session runs as. Had the host belonged to the workspace, a company
workspace's sessions would spend the personal subscription with no row
anywhere saying so. When the accounts slice arrives, note 06's
`Account.ownerUserId` and `Account.hostId` hang off the same two
things, and a session gains an `accountId` per provider.

### Two operating principles worth stating

**Files are the ledger; prompts are nudges.** Every "have I already told
you this" decision is a hash comparison against what we last recorded,
not a delivery receipt. A missed notification then loses nothing, which
is the right posture when the other end is a laptop on hotel wifi.

**Never hold a lock across a subprocess.** Session create does git work
that can take a minute; the row lock is taken to commit the result, not
to cover the work. herdr-projects states this as a rule and it is the
difference between a slow create and a stalled project.

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

**Redemption and host creation are one transaction**, and a lost
response is not a lost host. The burn statement and the `INSERT` into
`host` commit together, with `redeemedHostId` written in the same
transaction. The install command sends the host's public key with the
token, so a retry after a dropped response is idempotent by design:
zero rows from the burn is followed by one read of the token by hash,
and if `redeemedHostId`'s `publicKeyFingerprint` equals the fingerprint
just presented, the same host is returned; every other case is the one
failure. A `@Throttle` on the route bounds guessing (F5).

**Rotation (F8) is a runner-initiated frame on the uplink**, signed by
the current key and carrying the next public key. The control plane
moves `publicKey` to `previousPublicKey`, sets
`previousPublicKeyExpiresAt = now() + 24h`, stores the new key and
fingerprint, and acknowledges; the runner switches keys only on the
acknowledgement, so a lost one leaves it on a key that is still valid.
Boot lookup is by fingerprint on **either** column, which is why
`previousPublicKeyFingerprint` is a column too, indexed. A host is never
left with zero valid keys.

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

### Where the two sockets live, and what guards them

The module contract has a place for a gateway: `*.gateway.ts` is an
allowed file in `infrastructure/` (`scripts/check-api-structure.mjs`),
so `relay/infrastructure/runner-uplink.gateway.ts` and
`browser-attach.gateway.ts` are legal, on `@nestjs/websockets` with
`@nestjs/platform-ws` — plain `ws`, not socket.io, because one peer is a
Go binary. Both are new dependencies. What the contract does **not**
give them is a guard: `PoliciesGuard` and `ScopesGuard` are HTTP guards
registered as `APP_GUARD`, they read the request off `switchToHttp()`,
and `route-policy-coverage.spec.ts` walks controllers, not gateways. A
WebSocket handler is therefore **unguarded by default, and nothing
fails the build to say so.** The rule that replaces the guard: each
gateway authenticates in the handshake — the runner's assertion and its
burned `jti`; the browser's ticket `take()` and the re-check at consume
— before `handleConnection` returns, closes with a 4xxx code otherwise,
and a spec per gateway asserts that a connection with no credential is
closed before any frame is handled. Those two specs are the coverage
test the HTTP surface gets for free.

**One replica, decided.** The first draft carried `connectionEpoch` and
`connectedReplicaId` on `host` so that two API replicas could fight over
a socket during failover and the late writer would lose. The deployment
is one replica for now, and the relay's in-memory registry is then the
only writer of a host's connection state: its own connect and
disconnect callbacks run in order in one process, and a reconnecting
host's new socket replaces the old one in the registry before the old
one's close handler fires. Both columns go. `lastSeenAt` is the
heartbeat, and *online* is `lastSeenAt > now() − 2 × heartbeat`,
computable in the list query with no call into the relay. The named
upgrade, when a second replica comes: the registry becomes a Redis map
keyed by host, frames between replicas ride Redis pub/sub, and the epoch
and replica id return as the fence — a slice, not a rewrite, because
nothing outside `relay/` reads either.

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
`user_settings` already follow), and an owner column — `organizationId`
on the six workspace-owned tables, exactly as `lead` does;
`ownerUserId` / `createdByUserId` on the two host tables, exactly as
`account` and `passkey` do.

### Eight new tables

**`hosts/`**

- `host` — `id`, `ownerUserId`, `name`, `hostname`, `os`, `arch`,
  `runnerVersion`, `capabilities` jsonb (git/tmux/disk and the detected
  agents), `publicKey` text, `publicKeyFingerprint`,
  `previousPublicKey` text null, `previousPublicKeyFingerprint` null,
  `previousPublicKeyExpiresAt` null, `lastSeenAt`, `unpairedAt`,
  timestamps. Index `(ownerUserId)`; unique `(publicKeyFingerprint)`;
  index `(previousPublicKeyFingerprint)`. No `organizationId`, no
  `connectionEpoch`, no `connectedReplicaId` — see above for each.

  **The key is a column, not a table**, per rule 2 and the `account`
  precedent. Rotation (F8) needs the old key valid for a grace window,
  which is *two* keys, never N. This also takes a join off the hottest
  path in the system: every runner boot verifies an assertion against
  this row.

- `host_pairing_token` — `id`, `createdByUserId`, `intendedName`,
  `prefix`, `tokenHash` unique, `createdFromIp` inet, `redeemedFromIp`
  inet, `expiresAt`, `revokedAt`, `redeemedAt`, `redeemedHostId`.
  Index `(createdByUserId)`. F5's "source IP shown" is two columns, not
  one. The host it creates belongs to `createdByUserId`.

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
  `fullName`, `owner`, `name`, `storeDirectoryName`, `defaultBranch`,
  `isPrivate`, `isArchived`, `hiddenAt`, `removedAt`, `syncedAt`,
  timestamps. Unique `(installationId, githubRepoId)`,
  `(organizationId, storeDirectoryName)` and `(organizationId, id)`;
  index `(organizationId, fullName)` — the repo chip is one index scan
  with no join, which is why `organizationId` is copied down. A
  repository never moves workspace (you disconnect and reconnect
  instead), so the copy is an invariant, not a sync.

  **Rows are never hard-deleted.** A session's checkout references a
  repository row, so a resync that deleted rows would either break the
  foreign key or cascade into a live session's checkouts. A repository
  that leaves the installation gets `removedAt`, and gets it cleared if
  it comes back; the chip filters `removedAt IS NULL AND hiddenAt IS
  NULL`; a checkout on a removed repository keeps its row and simply
  cannot mint a token any more, which git reports as the plain
  authentication failure it is.

  **`storeDirectoryName` is set once and never changes.** Worktrees
  point at their store by absolute path, so the store cannot move — and
  `fullName` moves on every GitHub rename or transfer. The name is
  `<owner>--<repo>.git` at row creation, then frozen, the same lesson
  as `project.slug`.

No `github_webhook_delivery` table. Every delivery triggers a **full
resync** of that installation's repository set, which is idempotent by
construction and immune to `added`/`removed` arriving out of order, so
de-duplication only saves a redundant GitHub call — a Redis key with a
24-hour TTL is the right weight. **Three webhooks, not one**, because
`installation_repositories` never fires for an installation on *all*
repositories: `installation` (suspend, unsuspend, delete),
`installation_repositories` (the selected set changed), and
`repository` (created, deleted, renamed, transferred, archived). A
24-hour timed resync per installation and `POST
/installations/{id}/sync` are the belt to those braces.

**`projects/`**

- `project` — `id`, `organizationId`, `name`, `slug`,
  `originRepositoryId` null, `archivedAt`, timestamps. Unique
  `(organizationId, slug)` and `(organizationId, id)`; index
  `(originRepositoryId)`.

  **Both come from the GitHub repository name.** Auto-created on the
  first session for a repository: `slug` is the sanitised repository
  name, `name` starts as the same thing, and `originRepositoryId`
  records which repository did it, so the next session on that
  repository finds its project by a foreign key rather than by
  re-deriving a string. The MVP never shows a project chip —
  `00-scope.md` decided four chips, and a fifth is real friction on the
  most-used screen for a concept with one instance. `POST /sessions`
  takes an optional `projectId`; absent, the project is the one whose
  origin is the first checkout's repository.

  **Auto-creation is a race and is written as one.** Two concurrent
  creates on a fresh repository both try the insert:
  `INSERT … ON CONFLICT (organizationId, slug) DO NOTHING` then reselect
  by `originRepositoryId`. If the reselect finds the slug held by a
  project with a *different* origin — `acme/xrp-mobile` and
  `other/xrp-mobile` sanitise to the same slug — the slug gets a short
  random suffix and the insert runs again. Never a second query that
  assumes the first won.

  **Rows are never hard-deleted**; closing sets `archivedAt`, so
  `uq (organizationId, slug)` is a permanent tombstone for the directory
  name, exactly as `work_session.slug` is. herdr-projects is the warning
  here: deleting a project there frees its slug immediately while the
  privilege grants keyed by its path survive, so a new project of the
  same name silently inherits the old one's approvals — their own code
  prints a warning about it. Grants here key on the project's UUID and
  the slug is never reissued, so neither half of that can happen.

  **`slug` is immutable; `name` is free.** The slug is a directory name
  on every host, so a rename that changed it would have to move
  `projects/<old>/` on every machine holding the project, with live
  sessions inside it. Splitting them makes renaming display-only and
  free. This is the same lesson as rule 1 above: a path is never an
  identity. The cost is that a project's directory keeps its first
  repository's name for ever, so `projects/xrp-mobile/` can hold a
  project called something else — cheap against moving directories
  under running sessions.

**`sessions/`**

- `work_session` — `id` (UUID v4, unguessable per F25, and also the tmux
  session name), `organizationId`, `projectId`, `createdByUserId`,
  `hostId`, `name`, `slug`, `agent`, `cwdCheckoutId` null,
  `idempotencyKey` null, then the fold: `state`, `stateSeq`,
  `agentSessionId`, `lastEventAt`, `stoppedAt`, timestamps.
  Index `(organizationId, state, createdAt DESC)` for the sidebar;
  `(projectId, state)`; `(hostId, state)` for runner reconciliation;
  unique `(projectId, slug)`, `(organizationId, id)`, and
  `(organizationId, idempotencyKey) WHERE idempotencyKey IS NOT NULL`.

  **Cross-tenant references are unrepresentable, not just unchecked.**
  `projectId` is held by the composite key
  `FOREIGN KEY (organizationId, projectId) REFERENCES project
  (organizationId, id)`, so a session cannot sit in another workspace's
  project whatever a handler forgets. `hostId` cannot be a key of that
  kind — a host has no `organizationId`, and a *grant* is a row, not a
  column — so the create handler loads the host through the
  own-or-grant-scoped `HostRepository` and refuses on a miss; that is
  the one reference in the schema that a handler check guards, and it
  is named here so nobody assumes a constraint that is not there.

  `idempotencyKey` is the client's `Idempotency-Key` header on
  `POST /sessions`, stored so a retry after a lost response returns the
  session already created rather than minting a second directory and a
  second branch. Absent header, absent protection; the console always
  sends one.

  `cwdCheckoutId` is **where the agent is launched** — the one fact that
  matters — encoded directly instead of through a flag on a checkout.
  Set, and the agent starts inside that checkout with the others as
  `../siblings`; null, and it starts in the session directory with every
  checkout a peer. A boolean on the checkout row could only express the
  first. Its foreign key is composite —
  `FOREIGN KEY (id, cwdCheckoutId) REFERENCES session_checkout
  (sessionId, id) ON DELETE SET NULL (cwdCheckoutId)` — so naming
  another session's checkout is unrepresentable. The column-list form
  is Postgres 15+, which `docker/` runs (16): without it, Postgres nulls
  *every* column of the constraint, `id` included, and the statement
  fails on the primary key. In practice the clause never fires, because
  checkout rows are not deleted; the remove-checkout command nulls
  `cwdCheckoutId` itself when it retires the checkout the agent was in,
  and the session degrades to its root rather than dangling.

  **Rows are never hard-deleted.** Closing sets `stoppedAt`. See rule 4
  above: `uq (projectId, slug)` is the tombstone that stops a new
  session inheriting a retired session's agent conversation state.

- `session_checkout` — `id`, `organizationId`, `sessionId`,
  `repositoryId`, `directoryName`, `mode` (`worktree` | `clone`),
  `baseBranch`, `branch`, `createdBy` (the provenance marker),
  `worktreeCreatedAt`, `pushedAt`, `removedAt`, `createdAt`.
  Foreign keys `(organizationId, sessionId) → work_session
  (organizationId, id)` and `(organizationId, repositoryId) →
  github_repository (organizationId, id)`, which together make a
  checkout of another workspace's repository unrepresentable — the
  escalation an earlier draft left to the handler. Unique
  `(sessionId, repositoryId) WHERE removedAt IS NULL` (a repository may
  be re-added after removal), `(sessionId, directoryName)` (a directory
  name is never reused inside a session, rule 4 again), and
  `(sessionId, id)` — the last so the composite key above can reference
  it. **Rows are never hard-deleted**; `DELETE
  /sessions/{id}/checkouts/{checkoutId}` runs `git worktree remove` with
  the same refuse-on-unpushed-work posture as closing a session, then
  sets `removedAt`.

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
POST   /sessions                  create Session     sessions:write   Idempotency-Key header
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

`POST /sessions` takes `{ hostId, agent, projectId?, name?, checkouts:
[{ repositoryId, baseBranch? }], cwdRepositoryId? }`: several
repositories, each with its base branch, the agent launched in the
first unless `cwdRepositoryId` says otherwise, and no branch name,
because the branch is always the session's. `name` is optional and
usually absent; the first prompt names the session.

Unauthenticated by design, and therefore carrying no `@RequireScopes`:

```
POST /hosts/pairing/redeem   credential = the registration token, checked in the handler; @Throttle
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
   granting the org-scoped `owner` role `manage` on `Project`,
   `Session`, `Installation` and `Repository` within
   `${activeOrganizationId}`, and on `Host` where
   `ownerUserId = ${userId}` — the host condition is the person, not
   the workspace — **and bumping `organization.roleVersion`**
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
6. The root `.env.example` gains `ANTHROPIC_API_KEY`, optional, with the
   note that it only names sessions and that leaving it unset disables
   naming and nothing else. `apps/api` gains `@anthropic-ai/sdk`,
   `@nestjs/websockets` and `@nestjs/platform-ws`.
7. `packages/backend/cache` gains `take<T>(key)` over `GETDEL`, the one
   primitive the single-use attach ticket needs.

### What changes in the committed client contract

The console's hand-rolled `SessionDto` is a stub with a comment saying
it switches to the generated SDK once these endpoints exist, and both
screens are empty states — so this is the moment to change it, and the
cost only grows.

```ts
interface SessionDto {
  id; name; slug; hostId; projectId; agent; state; createdAt;
  cwdCheckoutId: string | null;
  checkouts: {
    id; repository; directoryName;
    mode: 'worktree' | 'clone';
    baseBranch; branch;
  }[];
}

interface CreateSessionInput {
  hostId; agent; projectId?; name?;
  checkouts: { repositoryId; baseBranch? }[];
  cwdRepositoryId?;
}
```

`repository`, `baseBranch` and `branch` leave the session, because with
several checkouts they are per-checkout facts, and
`CreateSessionInput.repository` — a bare `owner/repo` string today —
becomes the `checkouts` array, which also closes the review's
"`owner/repo` is ambiguous across two installations" finding: a
`repositoryId` is not. `state` on the wire is the **derived group** of
the three vocabularies above — `working`, `waiting-on-you`,
`ready-for-review`, `landing`, `idle`, `resolved` — and
`waiting-on-you` is what [`00-scope.md`](00-scope.md)'s "blocked" dot
shows; the design system's `StatusState` already carries `needs-input`
for it. The mapping from the runner's five observations is complete,
and lives in the fold, not the client.

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
  few lines.

- **A host belongs to a person; workspaces borrow it.** The 2026-09-18
  decision gave a host both a workspace and an owner. The workspace
  column is gone: a person with a personal and a company workspace
  pairs one laptop once, the login on that laptop is theirs and not a
  workspace's, and Better Auth hangs every device-and-login table off
  `user`. The tenant boundary moved to `work_session.organizationId`
  and to a `workspaces/<organization.slug>/` level on disk.

- **One API replica**, so `connectionEpoch` and `connectedReplicaId`
  are gone and the relay's in-process registry is the connection truth.
  The multi-replica fence is a named slice inside `relay/`.

- **Sessions are named by their first prompt**, by a fast model behind a
  port, with the minted slug as the fallback name; the slug is opaque
  because it is a directory before it is a name.

- **Each checkout picks a base branch; the working branch is always
  `oppenheimer/<project>/<session>`**, never the base itself.

## Open questions

None outstanding in this note. The two that remained are decided above
and below:

- **`done` and `unknown`** are agent observations, not session states —
  see "Three state vocabularies".
- **`stop` does not mean close.** `POST /sessions/{id}/stop` ends the
  agent and the tmux session and **leaves every checkout on disk**, so
  `restart` can recreate window 0 in the same worktree after a host
  reboot. `DELETE /sessions/{id}` is the close: push each checkout's
  branch, then remove the worktrees and prune. It **refuses when a
  checkout has unpushed work** unless the caller explicitly accepts the
  loss, never passes `git worktree remove --force`, and relays git's own
  refusal verbatim rather than paraphrasing it. herdr-projects splits
  the same two verbs the same way and its `--remove-worktree` likewise
  insists the work is home first; that refuse-and-explain posture is the
  right default for a tool that owns other people's repositories.

The adversarial review's eleven act-on findings are folded in above,
each at the place it changed:

1. cross-tenant references — composite `(organizationId, …)` keys on
   `work_session` and `session_checkout`; the host reference is the one
   handler check, and is named as such;
2. `ON DELETE SET NULL (cwdCheckoutId)` in the column-list form;
3. resync never deletes — `github_repository.removedAt`;
4. redemption and host insert in one transaction, fingerprint-matched
   retry, `previousPublicKeyFingerprint` and the rotation frame;
5. `session_checkout.removedAt`, never hard-deleted, partial unique on
   the repository;
6. `Idempotency-Key` on `POST /sessions`;
7. `<runId>:<n>` runner keys and per-row `ON CONFLICT DO NOTHING`;
8. branch names carry the ids;
9. `project.originRepositoryId` and the auto-create race written as
   one;
10. gateways live in `relay/infrastructure/`, are unguarded by default,
    and authenticate in the handshake with a spec each;
11. three webhooks and a timed resync, because
    `installation_repositories` never fires for *all*.

Considered and left: `repositories:write` covering both connect and
disconnect (one scope, until a second caller wants only one).
