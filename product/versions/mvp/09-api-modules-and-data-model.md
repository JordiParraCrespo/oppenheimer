# 09 — API: modules and data model

The in-depth version of [`03-control-plane.md`](03-control-plane.md)'s
"Data model, first cut". That note named the modules and listed the
tables; this one decides the module boundaries, the aggregates, the
schema, and the endpoint surface, against the contract `apps/api`
actually enforces (`apps/api/ARCHITECTURE.md`,
`scripts/check-api-structure.mjs`, `apps/api/.dependency-cruiser.cjs`).

Scope: the control plane only. The runner's internals are
[`02-runner.md`](02-runner.md); the console is
[`05-screens.md`](05-screens.md). They appear here only as the
counterparties whose contract the API serves.

## The seven nouns, placed

| The noun | Where it lives | New? |
|---|---|---|
| **Organizations** (name, url, members) | the Better Auth `organization` + `member` tables, unchanged | no |
| **Hosts** | `hosts/` → `host` (keys inline), `host_pairing_token` | yes |
| **Sessions** | `sessions/` → `work_session`, `work_session_event` | yes |
| **Repositories** | `github/` → `github_repository` | yes |
| **GitHub allowed repositories** | *the same table* — the installation is the allowlist | — |
| **Coding agents** | a closed catalog in `packages/shared`, plus per-host availability on `host.capabilities` | no table |
| **Models** | no table, no column — a field on the shared catalog entry and on the session's launch spec in the log | no table |

Three of the seven resolve to "not a table". Each is argued below; none
is an oversight.

## Decided

### Four new modules, none named after a lifecycle stage

```
apps/api/src/
  hosts/      the machines that answer to a workspace
  github/     what GitHub grants this workspace, and how we exercise it
  sessions/   the unit of work, its event log, and attaching to it
  relay/      the live connection plane — no table, no aggregate
```

`organizations/` is **not touched**. The `organization` row already is
the personal workspace ([`08-auth.md`](08-auth.md)), and `AGENTS.md`
says that module is not an example to copy. Every new product table
carries `organizationId`, declares a resource with `defineResource`, and
uses a repository extending `ScopedRepositoryBase`, so the SQL predicate
and the CASL condition are generated from one declaration (F24).

**`hosts/`** owns which machines this workspace has paired, how we prove
a connecting process is one of them, what each machine can run, and
whether it is reachable now. Pairing lives here because a registration
token is host identity *before the host exists*.
Aggregates: `HostEntity` (the host, its current key and the previous one
still inside its rotation window — a host must never be left with zero
valid keys, which is why the pair lives on the aggregate rather than in
a child table) and `HostPairingTokenEntity` (its own lifecycle, minted
before any host exists, burned atomically).
It does **not** own the socket (that is `relay/`), the sessions on it,
or the agent catalog.

**`github/`** owns which App installations belong to the workspace,
which repositories they cover, and how to turn that into a one-hour
token narrowed to one repository. One aggregate,
`GithubInstallationEntity`, holding the installation *and its repository
set*, because "these repositories, under this installation, at this
selection" is one invariant replaced as a whole by every
`installation_repositories` webhook. Named after the vendor on purpose —
[`09-github-app-install.md`](../../09-github-app-install.md) decided the
App installation *is* the access-control model, and a vendor-neutral
`source-control` port with one implementation would be speculative
generality. The vendor name stops at the directory: the CASL subjects
are `Installation` and `Repository`, the scope resource is
`repositories`, and no Octokit type leaves `infrastructure/`.

**`sessions/`** owns what a session is, what happened to it, what state
that implies, and who may open a terminal on it. `WorkSessionEntity`
holds its event log inside the aggregate, because the state invariant is
`state = fold(events)` and an event appended outside the aggregate could
desynchronise it. An attach ticket is deliberately *not* an aggregate:
it lives seconds, is redeemed once, and its redemption path must not
load a session — so it is a Redis key, not a row (see the schema below).

**`relay/`** owns which host is attached to which API process right now,
and how bytes reach it. It has no table and no aggregate, the same shape
as the existing `outbox/`, `throttling/` and `capabilities/` modules.
That is precisely why it is its own module and not a folder inside
`sessions/`: it is the only knowledge in the design that does not live
in Postgres. It holds no policy — it authenticates by asking `hosts/`,
authorises attach by asking `sessions/`, and records facts by
dispatching a command.

`relay/` is not temporal decomposition. `session-create`,
`session-relay` and `token-minter` as three modules would be; grouping
by knowledge owned is what rules them out.

### The published surface between modules is deliberately tiny

| Module | What another module may call | What that hides |
|---|---|---|
| `github/` | `RepositoryAccessPort` — `assertReachable`, `tokenFor` | App JWT signing from the secret store, narrowing a token to one repository id, caching and rotation, webhook HMAC, Octokit |
| `hosts/` | `HOST_REPOSITORY`, `verify-host-assertion` query | Ed25519 verification, key rotation with a grace window, liveness fencing across replicas |
| `sessions/` | `SESSION_REPOSITORY`, three commands | The state fold and its ordering guard, ticket lifecycle, job dispatch through the outbox |
| `relay/` | `RunnerChannelPort` — `send`, `isConnected`, `disconnect` | Connection registry, envelope framing, binary PTY passthrough, flow control, cross-replica routing |

`RepositoryAccessPort` is the deepest: two methods stand in front of the
entire GitHub App, and no caller ever learns that installations exist.

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
- The append and the fold happen in **one transaction**. The cache is
  built by the same write, never by a separate sync job, so the sidebar
  is never eventually-consistent with its own log.

A replay of the log rebuilds the column at any time, which is the test
that it is genuinely derived.

### Credentials are rows only when they must be revocable

- **The pairing token is a row**, because F5 demands revocation, an
  expiry and a source IP — three things you can only act on if they
  persist. Burning it is one atomic statement:
  `UPDATE … WHERE tokenHash = $1 AND redeemedAt IS NULL AND
  expiresAt > now() RETURNING …`. Zero rows is the only failure, and it
  does not distinguish used, expired and forged, on purpose. Only the
  SHA-256 is stored.
- **The attach ticket is not**, because nothing about it is revocable:
  it expires in thirty seconds, which is faster than anyone could revoke
  it. A Redis key with a TTL says the same thing with no row to sweep.
  The rule is revocability, not "it is a credential".
- **Installation access tokens are not rows at all.** They are minted on
  demand from the App key in the secret store and cached in Redis until
  shortly before expiry. F20 and F23 become structural facts rather than
  rules someone has to remember.
- The pairing token remembers `redeemedHostId`, so an installer that
  retries after a dropped response gets the same host back instead of a
  409.

### The runner makes exactly one HTTP call, ever

`POST /hosts/pairing/redeem`, from the install command, before the host
has a key to authenticate with. Everything after that — reconciliation,
event append, token delivery and rotation, session start and stop, PTY
bytes — rides the single outbound WebSocket, as
[`00-scope.md`](00-scope.md) decided ("no ports on the host, ever… the
runner holds one outbound WebSocket") and [`08-auth.md`](08-auth.md)
decided for the token specifically ("the control plane mints a one-hour
installation token narrowed to the session's repository and **hands it
to the runner over the relay**"). Job payloads are sealed to the host's
public key, which is F7 met rather than avoided.

A hybrid shape — ordinary `/api/v1/runner/*` HTTPS routes for
request/response, the socket only for push — is tempting, because it
would inherit RFC 7807 errors, throttling, Swagger and a generated typed
client, which is what `apps/runner/ARCHITECTURE.md` asks for. It is
rejected here for two reasons. It contradicts the two decided notes
above and would need them changed first. And it would satisfy F7 by
avoidance: "no secret travels in a pushed frame because the token is
pulled instead" leaves the finding technically unviolated and
substantively unaddressed.

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

### The three "not a table" decisions

**Models.** No table, no column, no endpoint. A model is a launch option
of an agent, not a platform entity, and
[`07-mvp.md`](../../07-mvp.md) says a model picker is explicitly a later
idea — the New session screen has four chips and none of them is a
model. The seam is an optional `model` in the session's launch spec,
which is recorded in the log; because the log is the source of truth,
promoting it to a column later is a replay, not a backfill of data we
never captured. A catalog table today would be a `GET /models` surface
hiding no policy at all, read by nothing.

**Coding agents.** No table either, and no `agents/` module. The catalog
is `packages/shared/src/agents/catalog.ts` — id, binary name, config-dir
env var, and the login-URL hosts F3 needs for linkifying — shared by the
console, the API and, through generated types, the runner. A row would
be a second, driftable source of truth for something that needs runner
code to launch and detect anyway, so a deploy happens either way. The
*dynamic* half — does this machine actually have `claude` on PATH — is a
host fact, reported in the runner's preflight and stored on
`host.capabilities`. No vendor credential ever reaches the platform
(F23); agent login stays the host's own.

**Repositories and "GitHub allowed repositories" are one noun.**
`github_repository` rows *are* the allowlist, because the App
installation is a boundary GitHub enforces server-side and the
`installation_repositories` webhook keeps our copy current. A second
`allowed_repository` table could only ever be a subset of a boundary we
do not own, would drift on every webhook, and would invent the failure
mode "the repo is in our allowlist but the token mint fails". What it
would buy — one workspace member seeing fewer repositories than the
installation covers — is a teams-slice feature on a product with one
user per workspace, and when it arrives it is an `access_grant` row over
the `Repository` subject, which the authz kernel already supports. The
cheaper seam, a per-workspace hide/favourite over a large "All
repositories" installation, is a nullable `hiddenAt` column, not a table.

### The schema follows Better Auth's own shape

The starter's identity tables are the reference for how a table earns
its place here, because they are the tables this codebase already reads
every request. Four rules, read off `apps/api/src/auth/database/`:

1. **Rows are flat.** Situational state is a nullable column, never a
   satellite table. `session` carries `delegated`,
   `delegatedCredentialId`, `impersonatedBy`, `activeOrganizationId` and
   `activeTeamId` on one row rather than in four side tables.
2. **Credentials sit inline with the thing they authenticate.**
   `account` holds `password`, `accessToken`, `refreshToken`, `idToken`
   and four expiries on the same row as the provider link.
3. **A short-lived token gets its own table, shared across kinds.**
   `verification` is `identifier` + `value` + `expiresAt`, and serves
   email verification, password reset and magic links alike.
4. **A table earns its place by independent lifetime**, not by being a
   different noun. `account` outlives any `session`; `verification`
   exists before the thing it verifies.

Applied honestly, those rules delete three tables from an earlier draft
of this note: a `host_key` table (rule 2), an `attach_ticket` table
(rule 4 — it cannot outlive the thirty seconds it is valid for), and a
`github_webhook_delivery` table (the handler is a full resync, so it is
already idempotent and de-duplication is an optimisation).

Uniform across all six: `id` uuid primary key minted with `randomUUID()`,
`@CreateDateColumn`/`@UpdateDateColumn`, snake_case name (the convention
every app-owned table already follows — `api_token`, `user_role`,
`access_grant`, `user_settings`), and an `organizationId` for the tenant
scope, exactly as `lead` does.

### Six new tables

**`hosts/`**

- `host` — `id`, `organizationId`, `pairedByUserId`, `name`, `hostname`,
  `os`, `arch`, `runnerVersion`, `capabilities` jsonb (git/tmux/disk and
  the detected agents), `publicKey` text, `publicKeyFingerprint`,
  `previousPublicKey` text null, `previousPublicKeyExpiresAt` null,
  `lastSeenAt`, `connectionEpoch` bigint, `connectedReplicaId`,
  `unpairedAt`, timestamps. Index `(organizationId)`; unique
  `(publicKeyFingerprint)`.

  **The key is a column, not a table**, per rule 2 and the `account`
  precedent. Rotation (F8) needs the old key to keep working for a grace
  window, which is *two* keys, never N — so it is a second column pair,
  not a one-to-many. This also takes a join off the hottest path in the
  system: every runner boot verifies an assertion against this row.

- `host_pairing_token` — `id`, `organizationId`, `createdByUserId`,
  `prefix`, `tokenHash` unique, `createdFromIp` inet, `redeemedFromIp`
  inet, `expiresAt`, `revokedAt`, `redeemedAt`, `redeemedHostId`. F5's
  "source IP shown" is two columns, not one.

  **This one stays a table**, and Better Auth is the reason: it is
  `verification`. A token that exists *before its subject does* cannot
  be a column on that subject, and most rows never become a host — they
  expire, get revoked, or are superseded by a second Add-host click.
  Independent lifetime is exactly rule 4.

**`github/`**

- `github_installation` — `id`, `organizationId`, `githubInstallationId`
  bigint unique, `accountLogin`, `accountType`, `repositorySelection`
  (`all` | `selected`), `installedByUserId`, `suspendedAt`, `syncedAt`,
  `deletedAt`, timestamps.
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
construction and immune to `added`/`removed` arriving out of order. So
de-duplication only saves a redundant GitHub call, never correctness —
a Redis key with a 24-hour TTL is the right weight for that.

**`sessions/`**

- `work_session` — `id` (UUID v4, unguessable per F25, and also the tmux
  session name), `organizationId`, `createdByUserId`, `hostId`,
  `repositoryId`, `repositoryFullName` (denormalised so a session
  survives an uninstall), `name`, `slug`, `baseBranch`, `branch`,
  `agent`, then the fold: `state`, `stateSeq`, `agentSessionId`,
  `worktreePath`, `lastEventAt`, `stoppedAt`, timestamps.
  Index `(organizationId, state, createdAt DESC)` for the sidebar;
  `(hostId, state)` for runner reconciliation; unique `(hostId, slug)`
  so two sessions cannot claim one worktree directory.
- `work_session_event` — `id`, `sessionId`, `seq`, `idempotencyKey`,
  `source` (`runner` | `api`), `kind`, `payload` jsonb, `occurredAt`,
  `recordedAt`. Unique `(sessionId, seq)` and unique
  `(sessionId, idempotencyKey)`. Every read is by session, so no other
  index is needed.
No `attach_ticket` table. A ticket lives about thirty seconds and is
used once, so it fails rule 4 outright — it cannot have an independent
lifetime, and a table for it is a high-churn row plus a sweeper to
delete what Redis would have expired by itself. It becomes a Redis key,
`attach:<random>` → `{sessionId, window, userId}`, with the TTL doing
the expiry.

**This costs one new primitive, and that is the honest trade.**
`CacheService` today is `get`/`set`/`del`/`reset`
(`packages/backend/cache/src/cache.service.ts`), and `get`-then-`del` is
a race two relay connections could both win. Single use needs an atomic
read-and-delete, so the abstraction gains `take<T>(key)` over Redis's
`GETDEL`. That is a few lines and a genuinely reusable primitive — any
single-use token wants it — but it is a change to a shared package, not
free. If that is unwanted, the fallback is the table, where
`UPDATE … WHERE consumedAt IS NULL RETURNING` is atomic with no new
tooling. The table is the safer choice; Redis is the better-engineered
one.

Either way the durable record is an `attach.opened` entry in the session
log, which is a better audit trail than a thirty-second row.

`worktreePath` is **stored, not computed**: the layout rule in
[`11-workspace-layout.md`](../../11-workspace-layout.md), including the
`<owner>--<repo>` collision case, is the host's fact, so the runner
reports it in an event.

There is no `jobs` table. The desired state is already the session row,
and the outbox is already a durable queue; a `jobs` table would be a
second copy to keep in sync with the row it describes.

### The endpoint surface

Console-facing, all `/api/v1`, all with `@CheckPolicies` +
`@RequireScopes` + Swagger decorators:

```
GET    /hosts                     read Host          hosts:read
GET    /hosts/{id}                read Host          hosts:read
PATCH  /hosts/{id}                update Host        hosts:write
DELETE /hosts/{id}                delete Host        hosts:write
POST   /hosts/pairing             create Host        hosts:write
GET    /hosts/pairing             read Host          hosts:read     (F5: outstanding tokens + source IP)
DELETE /hosts/pairing/{id}        delete Host        hosts:write

GET    /repositories              read Repository    repositories:read
GET    /repositories/{id}/branches read Repository   repositories:read
GET    /installations             read Installation  repositories:read
POST   /installations             create Installation repositories:write
POST   /installations/{id}/sync   update Installation repositories:write
DELETE /installations/{id}        delete Installation repositories:write

GET    /sessions                  read Session       sessions:read
GET    /sessions/{id}             read Session       sessions:read
POST   /sessions                  create Session     sessions:write
PATCH  /sessions/{id}             update Session     sessions:write
POST   /sessions/{id}/stop        update Session     sessions:write
DELETE /sessions/{id}             delete Session     sessions:write
GET    /sessions/{id}/events      read Session       sessions:read
POST   /sessions/{id}/attach-ticket  attach Session  sessions:write
```

`attach` is a **distinct CASL action**, so a read-only credential can
list sessions without being able to open a PTY on one.

Two more console routes the screens need:

```
GET    /hosts/pairing/{id}        read Host     hosts:read   → redeemedHostId
POST   /sessions/{id}/restart     update Session sessions:write
```

`GET /hosts/pairing/{id}` is how Add host "flips to online"
([`05-screens.md`](05-screens.md)) without polling the whole host list —
the console's `usePairHost` deliberately does not invalidate it.
`restart` is required by [`02-runner.md`](02-runner.md): a host reboot
shows every session as stopped with a Restart button that recreates
window 0 in the same worktree.

`POST /sessions/{id}/attach-ticket` returns `{ticket, url, expiresAt,
window, hint}`. `window` because tabs are tmux windows in one tmux
session (`02-runner.md`), so a ticket authorises one window, not a
session. `hint` because [`01-protocol.md`](01-protocol.md) decided
tickets can carry structured hints — `host-offline`,
`runner-update-required`.

Not HTTP at all: the runner uplink (`GET /relay/runner`, WebSocket,
host assertion) and everything it carries. See the transport section
above.

Unauthenticated by design, and therefore carrying no `@RequireScopes`:

```
POST /hosts/pairing/redeem   credential = the registration token, checked in the handler
POST /github/webhook         credential = X-Hub-Signature-256 over the raw body
GET  /relay/attach?ticket=   credential = the single-use ticket; Origin checked (F2)
```

Each carries `@NoPolicy('<reason>')` rather than no decorator at all:
`PoliciesGuard` fails closed, and
`apps/api/src/auth/__tests__/route-policy-coverage.spec.ts` turns a
missing declaration into a build failure. The exemption returns before
the `request.user` check, so it is the intended way to model a route
with no principal.

The install command and the agent install prompt are served from
`POST /hosts/pairing`'s response, templated from deploy-owned runner
release config (version, URLs, SHA-256 checksums) — not from a database
column. A workspace-writable launch or install string would be remote
code execution on a host.

### What changes outside `apps/api`

1. `packages/shared/src/scopes/catalog.ts` — `SCOPE_RESOURCES` grows
   from 11 to 14 with `hosts`, `sessions`, `repositories`, each with a
   `PERMISSION_GROUPS` entry naming the CASL policies that back it, so
   `grantableScopes` can still refuse a token with more reach than its
   creator.
2. `packages/shared/src/agents/catalog.ts` — the coding-agent catalog,
   imported by the console through a narrow subpath.
3. Zod schemas for the session and host shapes, which nothing validates
   today.
4. **The owner role, in two places that must agree.** A data migration
   granting the org-scoped `owner` role `manage` on `Host`, `Session`,
   `Installation` and `Repository` within `${activeOrganizationId}`,
   **and bumping `organization.roleVersion`** so cached abilities
   refresh — `ScopeResolver` and `UserRoleRepository` key their caches
   on it. And the same four entries added to
   `SYSTEM_ROLE_PERMISSIONS.owner` in
   `packages/shared/src/permissions/abilities.ts`, because the seed
   writes roles from that constant and `AddOwnerRole` says the migration
   mirrors it. The migration alone fixes existing databases; the
   constant alone fixes freshly seeded ones. Miss either and a workspace
   owner is refused from every new route — and both are invisible to any
   test that stubs the ability.
5. `pnpm generate:api-client`, plus a changeset. The console then drops
   the hand-rolled DTOs in `packages/frontend/consumer` that today call
   `/api/v1/sessions` and `/api/v1/hosts` directly. Two more consumers
   regenerate with it: `apps/cli/src/lib/api-types.ts` and the tool
   definitions in `apps/mcp/src/tools/`. Neither has a sessions or hosts
   command today; both will once the scopes exist.

### One additive change to the committed client contract

The console's `SessionState` is
`starting | running | idle | stopped | failed`. It gains **`blocked`**:
[`00-scope.md`](00-scope.md) names the sidebar dot's three states as
working, blocked and idle, and the design system's `StatusState`
already carries `needs-input`. Without it the one feature the dot
exists for is unrepresentable on the wire.

That is the only union change. `stopping` was considered and dropped —
`POST /sessions/{id}/stop` answering 202 on an already-stopping session,
plus `stateDetail`, covers the same ground without a second wire break.

The mapping is still not complete, and that is open question 8 below:
[`02-runner.md`](02-runner.md) has the screen manifest classify a pane
as `working, blocked, done, idle, unknown`, and adding `blocked` maps
three of those five. `done` and `unknown` have no home in
`SessionState`, and the design system has a seventh value, `completed`,
that nothing produces.

Everything else the console has committed to keeps its exact shape:
the URLs, `CreateSessionInput`, `HostDto`, and `HostPairingDto`.

## Build order

Each step is a vertical slice that can land alone.

1. `packages/shared`: the three scope resources, the four subjects, the
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
4. `sessions/` — the row, the log and the fold, with no relay: create,
   list, stop, events.
5. `relay/` — the runner uplink and the browser attach, which turns the
   step-one spike ([`06-step-one-spike.md`](06-step-one-spike.md)) into
   the real path.

## Open questions

1. **Is `owner/repo` unique inside one workspace?** A workspace can hold
   two installations (a personal account's and an org's). The console's
   committed `CreateSessionInput.repository` is a bare `"owner/repo"`
   string with no room for an installation id. If the same full name can
   appear twice, creation needs disambiguation and the DTO has to grow.
2. **Attach ticket lifetime and reuse.** Carried over from
   [`01-protocol.md`](01-protocol.md). 30 seconds and single-use is the
   proposal; is that too tight for a phone on a cold radio?
3. **Is the pairing token bound to the minting user or only to the
   workspace?** Still open from [`08-auth.md`](08-auth.md). The proposal
   is workspace-bound with `createdByUserId` for audit, so a token does
   not stop working if the person is removed mid-install.
4. **Does F5's "source IP shown" survive the proxy?** The control plane
   sits behind one. `credential-scope.resolver.ts`'s own `sourceAddress`
   helper notes that `request.ip` is the proxy's address unless Express
   `trust proxy` is set, so recording `request.ip` into `createdFromIp`
   and `redeemedFromIp` would show the load balancer on every row. Is
   `trust proxy` set in the deployment, and how many hops?
5. **Is the App configured with "request user authorization during
   installation"?** Claiming an installation into a workspace must prove
   the signed-in user can actually see it — otherwise
   `POST /installations` with someone else's `installation_id` hands the
   caller tokens to their repositories. The check is to exchange the
   OAuth `code` GitHub attaches to the same redirect, list the user's
   installations, verify, and discard the code. Without that parameter
   the fallback is to accept only installations whose `account.login`
   matches a GitHub account linked to the caller.
6. **Does `stop` mean "close"?** [`00-scope.md`](00-scope.md) defines
   closing as push the branch and remove the worktree. If `stop` should
   instead leave the worktree for a later Restart after a host reboot,
   the client's verb wants renaming before the SDK is generated.
7. **Host JWT replay.** Is a five-minute boot JWT over TLS enough, or
   should `hosts/` keep a short Redis set of seen `jti`s?
8. **What do `done` and `unknown` become?** The screen manifest
   ([`02-runner.md`](02-runner.md)) classifies a pane as `working,
   blocked, done, idle, unknown`. Adding `blocked` to `SessionState`
   maps three of the five. Does `done` collapse into `idle`, or does the
   sidebar want to distinguish "the agent finished its task" from "the
   agent is waiting"? The design system already carries a `completed`
   value that nothing currently produces. And does `unknown` mean a
   sixth state, or the absence of a recent event?
9. **Can a second workspace claim an installation the first already
   has?** `POST /installations` needs an `INSTALLATION_ALREADY_CONNECTED`
   409 for the case where the GitHub installation id is already held by
   a different workspace — otherwise two workspaces silently share one
   repository cache and one token source.
