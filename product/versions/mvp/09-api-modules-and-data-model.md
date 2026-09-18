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
| **Hosts** | `hosts/` → `host`, `host_key`, `host_pairing_token` | yes |
| **Sessions** | `sessions/` → `work_session`, `work_session_event`, `attach_ticket` | yes |
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
Aggregates: `HostEntity` (the host and its keys — rotation is a host
invariant, a host must never be left with zero active keys) and
`HostPairingTokenEntity` (its own lifecycle, burned atomically).
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
desynchronise it. `AttachTicketEntity` is separate: seconds-lived,
burned in one statement, and its redemption path must not load a session.

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

- **Pairing tokens and attach tickets are rows.** F5 demands revocation
  and a source IP; F1 demands single use. Both are then one atomic
  statement — `UPDATE … WHERE tokenHash = $1 AND redeemedAt IS NULL AND
  expiresAt > now() RETURNING …`. Zero rows is the only failure, and it
  does not distinguish used, expired and forged, on purpose. Only the
  SHA-256 is stored.
- **Installation access tokens are not rows at all.** They are minted on
  demand from the App key in the secret store and cached in Redis until
  shortly before expiry. F20 and F23 become structural facts rather than
  rules someone has to remember.
- The pairing token remembers `redeemedHostId`, so an installer that
  retries after a dropped response gets the same host back instead of a
  409.

### The runner talks HTTPS for request/response and one WebSocket for push

Registration, reconciliation, event append and token minting are
ordinary versioned routes under `/api/v1/runner/*` behind a
`RunnerAuthGuard` that verifies the boot JWT against the host's stored
public key and binds a *host* principal. They inherit RFC 7807 errors,
throttling, Swagger and therefore a generated typed client — which is
what `apps/runner/ARCHITECTURE.md` already asks for. The one outbound
WebSocket carries what must be pushed (`session.start`, `session.stop`,
`attach.*`, PTY input) and what streams (PTY output).

**No frame pushed to a runner ever carries a secret.** The git token is
*pulled* by the credential helper over the host-authenticated HTTPS
channel. That is what makes F7 satisfiable by construction in the MVP:
there is no secret in a job payload to encrypt.

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

### Nine new tables

**`hosts/`**

- `host` — `id`, `organizationId`, `pairedByUserId`, `name`, `hostname`,
  `os`, `arch`, `runnerVersion`, `capabilities` jsonb (git/tmux/disk and
  the detected agents), `lastSeenAt`, `connectionEpoch` bigint,
  `connectedReplicaId`, `unpairedAt`, timestamps.
  Index `(organizationId)`.
- `host_key` — `id`, `hostId`, `algorithm`, `publicKey`, `fingerprint`,
  `activatedAt`, `revokedAt`. Rotation (F8) keeps the previous key valid
  for a grace window. Index `(hostId) WHERE revokedAt IS NULL`.
- `host_pairing_token` — `id`, `organizationId`, `createdByUserId`,
  `prefix`, `tokenHash` unique, `createdFromIp` inet, `redeemedFromIp`
  inet, `expiresAt`, `revokedAt`, `redeemedAt`, `redeemedHostId`. F5's
  "source IP shown" is two columns, not one.

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
- `github_webhook_delivery` — `deliveryId` PK, `event`, `receivedAt`.
  Deduplication has to survive a Redis flush, so it is a table.

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
- `attach_ticket` — `id`, `sessionId`, `userId`, `window` smallint,
  `tokenHash` unique, `expiresAt` (seconds), `consumedAt`,
  `consumedFromIp`, `createdAt`.

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

Runner-facing, behind `RunnerAuthGuard` (host principal, no user):

```
POST /runner/register                      the installer's one unauthenticated call
GET  /runner/sessions                      reconcile on connect
POST /runner/sessions/{id}/events          append, idempotent
POST /runner/sessions/{id}/git-token       mint/rotate, one repo, one hour
GET  /runner/connect                       WebSocket upgrade, boot JWT
```

Unauthenticated by design, and therefore carrying no `@RequireScopes`:

```
POST /runner/register        credential = the registration token, checked in the handler
POST /github/webhook         credential = X-Hub-Signature-256 over the raw body
GET  /relay/attach?ticket=   credential = the single-use ticket; Origin checked (F2)
```

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
4. A data migration granting the org-scoped `owner` role `manage` on
   `Host`, `Session`, `Installation` and `Repository` within
   `${activeOrganizationId}`, **and bumping `organization.roleVersion`**
   so cached abilities refresh. Without it every freshly provisioned
   workspace owner is refused from every new route — and it is invisible
   to any test that stubs the ability.
5. `pnpm generate:api-client`, plus a changeset. The console then drops
   the hand-rolled DTOs in `packages/frontend/consumer` that today call
   `/api/v1/sessions` and `/api/v1/hosts` directly.

### Two additive changes to the committed client contract

The console's `SessionState` is
`starting | running | idle | stopped | failed`. It gains:

- **`blocked`** — [`00-scope.md`](00-scope.md) names the sidebar dot's
  three states as working, blocked and idle, and the design system's
  `StatusState` already carries `needs-input`. Without it the one
  feature the dot exists for is unrepresentable on the wire.
- **`stopping`** — closing pushes a branch and removes a worktree, so
  pressing Stop twice must be a visible no-op rather than a lie.

Everything else the console has committed to keeps its exact shape:
the URLs, `CreateSessionInput`, `HostDto`, and `HostPairingDto`.

## Build order

Each step is a vertical slice that can land alone.

1. `packages/shared`: the three scope resources, the four subjects, the
   agent catalog, the Zod schemas.
2. `hosts/`, starting with `mint-host-pairing-token` and
   `register-host` — the smallest slice that exercises a new scope
   resource, a new CASL resource, a scoped repository, a single-use
   credential and a public route at once.
3. `github/` — installations, the repository cache, the webhook. It can
   be tested against a real App installation before any socket exists.
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
4. **Does the security review accept** "no secret ever travels in a
   pushed frame; the git token is pulled over host-authenticated HTTPS"
   as satisfying F7 for the MVP, or must `session.start` still be sealed
   to the host key even though it carries nothing sensitive?
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
