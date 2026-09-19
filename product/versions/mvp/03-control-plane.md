# 03 — Control plane

## Decided

- One Node process (NestJS, TypeORM, Postgres; the Flama starter's API)
  with modules: identity, installations, hosts, sessions, events, relay,
  tokens. Split by process later; the relay first. The starter's
  reference modules (leads, billing) are not composed into it.
- Identity is the starter's Better Auth setup: GitHub, Google, and email
  plus password on day one with account linking built in. Connect GitHub
  is a separate step that attaches an App installation to the signed-in
  user. The personal workspace is the `organization` row sign-up creates
  for the account (08-auth.md).
- Hosted in the same Hetzner region as the host. Public HTTPS for
  browsers and for the runners' outbound WebSocket; no inbound port on
  any host. Tailscale on the control plane is optional and only an
  admin path in the MVP.
- Serves the versioned install command and agent install prompt for
  Add host, with the current runner checksums.
- GitHub: one App with user authorization during installation. The
  installation is the access control. Per-session installation tokens
  narrowed to one repository, one-hour lifetime, rotated (note 09).
- The App private key lives in the secret store, never the database
  (F20). No vendor credential is ever stored (note 01 §7).
- Events are the source of truth per session; state is derived.

## Runner-facing surfaces

The runner speaks to three things, and only one of them is the link
(01). These are the control plane's side of it, and they are specified
here rather than in the notes that consume them:

The API mounts every route under `/api/v1` (a global `api` prefix and URI
version `1`), so the paths below carry that prefix and the runner's
`--url` stays the bare control-plane origin.

- `POST /api/v1/hosts/register` — spends a one-hour single-use registration
  token and answers with the host id, the control plane's key
  fingerprint (which the runner pins from then on), the release channel
  and the release base URL. Unauthenticated apart from the token; the
  source IP is recorded and shown (F5).
- `DELETE /api/v1/hosts/self` — uninstall, authenticated by the host's boot
  JWT rather than by the spent registration token. The JWT is presented as
  `Authorization: Bearer`, so the credential resolver must recognise a host
  principal alongside sessions and personal access tokens — the second
  verifier below. There is no id in the path: the host is the subject of
  the token it presented.
- **Host JWT verification.** Boot tokens are EdDSA over the host's
  Ed25519 public key, five minutes, `aud` the control plane's URL, with
  a `jti` worth replay-checking. That is a second verifier next to the
  starter's session cookies and `packages/go/auth`'s HS256 service
  tokens, and it is this module's to own.
- **The link's server half**: hello with a protocol range, the 15 s
  heartbeat, the hint vocabulary (`update_available`, `update_required`,
  `blocked`), and refusing a runner below `min_supported` *with* the
  hint rather than dropping it. Supported window: N-2 minor versions.
- **Release rollout.** Which version a channel offers a given host — a
  percentage, an allowlist, a stop — plus `min_supported` and the
  urgent flag. The manifest itself is signed offline and served from the
  release host, which is deliberately **not** this process: see F26a in
  07 and the hosting split below.
- **Hosting split.** The install script, the release artifacts and the
  control plane should not be one origin, because a host that serves
  both `install.sh` and the manifest can rotate the compiled-in key and
  the signature together. Open: whether that is three origins or two.
- No sleep scheduler in the MVP: hosts are always on and tmux holds
  sessions. The runtime-VM model and the scheduler return with the VM
  slice.

## The `github/` module, as built

The installations half of the control plane, implemented. Six routes, one
table, and one port for the slices that follow.

```
GET    /api/v1/installations                                            read Installation    repositories:read
POST   /api/v1/installations                                            create Installation  repositories:write
DELETE /api/v1/installations/{id}                                       delete Installation  repositories:write
GET    /api/v1/installations/{id}/repositories                          read Installation    repositories:read
GET    /api/v1/installations/{id}/repositories/{githubRepoId}/branches  read Installation    repositories:read
POST   /api/v1/github/webhook                                           signature, no policy
```

**One table, `github_installation`**: the workspace, GitHub's installation
id, the account it is on, what the dialog granted (`all` | `selected`), who
connected it, and the two dates that make it stop working — `suspendedAt`
and `deletedAt`. There is no repository table. The picker asks GitHub
through the installation's own token (one Redis key per installation, a
minute), branches are read live, and a repository is remembered only by the
checkout that took it.

**A claim is something a workspace holds, not something it once touched.**
`githubInstallationId` is unique among live rows only, so a disconnected or
uninstalled installation keeps its history and frees the number; a second
workspace connecting one another workspace still holds is a 409.

**There is no `Repository` CASL subject.** A repository has no row, so a
condition on one would either always deny or mean nothing. The routes that
list repositories and branches check `read Installation` — the access GitHub
is about to be asked to honour — while the credential scope keeps the name a
token holder thinks in, `repositories:read` / `repositories:write`.

**`RepositoryAccessPort` is what `sessions/` and `relay/` inject**, and the
only thing the module exports:
`mintRepositoryToken(installationId: uuid, githubRepoId: number)` returns a
token narrowed to that one repository, contents and metadata only, valid for
the hour GitHub gives it. `installationId` is *our* row's uuid, never
GitHub's number. **Nothing caches or stores it**: GitHub already gives it an
hour and the runner holds it in memory for that hour, and minting live is
what makes the guarantee true — a repository removed from the installation
stops working on the next mint rather than at the end of a TTL.

**One webhook**, `installation`, for suspend, unsuspend and uninstall,
verified as an HMAC over the raw body and applied as a conditional update on
the live row, so a delivery can never revive a claim a workspace gave up.

The App's six settings (`GITHUB_APP_*`, the slug included) are the
`github_app` capability, on the client wire subset so a console can tell "not
connected yet" from "this deployment has no App". Without them the module
boots, the list is empty, and every GitHub-backed route answers `GITHUB_002`.

## The `sessions/` module, as built

The work itself, implemented: the row, its checkouts, its append-only log,
and the fold of that log. Eleven routes and three tables, with no relay —
every read, write and state rule is testable without a host.

```
GET    /api/v1/sessions                                 read Session    sessions:read
GET    /api/v1/sessions/{id}                            read Session    sessions:read
GET    /api/v1/sessions/{id}/events                     read Session    sessions:read
POST   /api/v1/sessions                                 create Session  sessions:write   Idempotency-Key
PATCH  /api/v1/sessions/{id}                            update Session  sessions:write
POST   /api/v1/sessions/{id}/stop                       update Session  sessions:write
POST   /api/v1/sessions/{id}/restart                    update Session  sessions:write
POST   /api/v1/sessions/{id}/attach-ticket              update Session  sessions:write
POST   /api/v1/sessions/{id}/checkouts                  update Session  sessions:write
DELETE /api/v1/sessions/{id}/checkouts/{checkoutId}     update Session  sessions:write
DELETE /api/v1/sessions/{id}                            delete Session  sessions:write
DELETE /api/v1/projects/{id}                            update Project  projects:write
```

**Three tables.** `work_session` is the session: its workspace, its project,
the host it runs on, the agent, the slug, which checkout the agent was
launched in, and then the fold — `state`, `stateSeq`, `agentSessionId`,
`lastEventAt`, `stoppedAt`. `session_checkout` is one repository checked out
for one session, and is also **where a repository is remembered**: the
installation, GitHub's repository id, a name snapshot, the directory the
runner made and the store it found, the base branch and the session's own
branch. `work_session_event` is the log: `seq`, the writer's idempotency key,
`source`, `kind`, an 8 KB payload and two clocks.

**The log is the truth and the row is the fold.** `WorkSessionEntity` has no
`setState`; its only mutator is `recordEvent`, which runs a pure fold and
advances the projection, so replaying any log rebuilds the row. `seq` is
assigned by the control plane under `SELECT … FOR UPDATE` on the session row
— never by the writer — so a buggy or hostile host cannot create gaps or
regress the log, and the append and the fold commit in one transaction so the
sidebar is never eventually-consistent with its own log. Idempotency is per
row: one `INSERT … ON CONFLICT ("sessionId", "idempotencyKey") DO NOTHING`
each, `<runId>:<n>` from a runner and `<kind>:<commandId>` from the API.

**Three state vocabularies, not one.** The stored lifecycle is
`starting | open | failed | resolved` and answers *is this work finished* —
which is why stopping a session does not move it, and why `resolved` is
terminal. The agent's own observations (`working`, `blocked`, `idle`, `done`,
`unknown`) are inputs, never states. The **derived group** is what the sidebar
dot shows and is computed on read: `waiting-on-you` has four sources — the
session failed, the agent has been blocked for 30 s, a launch has sat unready
for 60 s, or the pane is gone with no report. The debounce is measured from a
**recorded transition**, so a caller with no history cannot claim a session
has been stuck for five minutes; and precedence ("a block beats an approved
pull request") is a different function from display order ("ready-for-review
sorts first").

**Cross-tenant references are unrepresentable, not merely unchecked.**
`(organizationId, projectId) → project` and
`(organizationId, installationId) → github_installation` are composite keys,
so a session in another workspace's project and a checkout through another
workspace's installation are both impossible whatever a handler forgets.
`hostId` is the one reference a check guards instead — a host belongs to a
person and carries no workspace column — so the create command loads it
through the own-or-grant-scoped repository and refuses on a miss. The host's
own foreign key is `ON DELETE RESTRICT`: a machine with sessions on it cannot
be unpaired out from under them.

**Nothing is ever hard-deleted.** Closing a session records `session.closed`,
the fold moves it to `resolved`, and the row stays for ever, so
`uq (projectId, slug)` is a permanent tombstone for a directory name — the
coding agents key their conversation state by working directory, and a new
session on a retired name would inherit a stranger's history. A checkout is
retired with `removedAt`, with the repository unique made partial so the
repository may come back while its old directory name never does. And when
the retired checkout was the agent's working directory, the session steps out
of it rather than dangling.

**`POST /sessions` is idempotent by header.** The client's `Idempotency-Key`
is a column with a partial unique per workspace, and the create statement's
conflict target is that key, so a retry after a lost response returns the
session already created instead of minting a second directory and a second
branch. The console always sends one.

**The attach ticket is a Redis key, not a table**: `attach:<random>` →
`{sessionId, organizationId, window, userId}`, claimed with `SET … NX` and
expiring in **60 seconds**. Single use is the real control, so the lifetime
buys reliability — mint, DNS, TLS and upgrade on a cold radio take five to ten
seconds — and the ticket travels in `Sec-WebSocket-Protocol`, never in the
query string, because proxies and CDNs log request lines and this ticket buys
an interactive shell. Opening a terminal is `update Session` behind
`sessions:write`: there is no `attach` verb. Until the relay exists the
response carries the hint `host_offline`, which is simply true — no host
holds a link.

**Archiving a project lands here**, because "is any session still open in
this directory" is the one question the archive command must ask and only this
module can answer it. It asks over the query bus and **fails closed**: if
nothing answers, the archive refuses (`PROJECTS_003`) rather than assuming the
answer it would prefer. An archived project is a tombstone on the create path
too — a session cannot be started in one, including the first session of a
repository whose project was archived.

**Naming is configuration.** A session is named by its minted slug until the
runner reports the first prompt, at which point a port in
`sessions/infrastructure/` asks a model for a title of at most forty
characters. `SESSION_NAMER_PROVIDER` (`none` by default),
`SESSION_NAMER_MODEL` and `ANTHROPIC_API_KEY` choose it, and with none
configured every session simply keeps its slug — which reads fine and costs
nothing. A title a model derived **never overwrites a name a person typed**,
and that rule lives in the fold, so a replay cannot break it. The one line
that leaves the host is the person's own prompt; the transcript it came from
does not.

**Two ports wait for the relay.** `SESSION_DISPATCH` sends a session's work to
a host and is bound, until then, to an adapter that records
`session.dispatch_pending` on the log — so "this was owed and never delivered"
is a durable fact with a timestamp. `RECORD_SESSION_EVENTS` is the other
direction: it takes a runner's batch and returns the acknowledgement that lets
the runner drop it from memory.

## Data model, first cut

users, installations, repositories (**not a table**: listed live from
GitHub through the installation; a repository is remembered only by the
checkout that took it, as GitHub's own id plus the installation and a
name snapshot), hosts, host pairing tokens, projects (the body of work a
session belongs to; auto-created from the first repository a session checks
out, and found again by that repository's GitHub id; its slug is a directory
name on every host and is never reissued), **work_session**
(workspace, project, host, agent, slug, name, the checkout the agent runs
in, and the fold of its log) — a session belongs to a project —,
**session_checkout** (one repository per session, on the session's own
branch, and where a repository is remembered), **work_session_event** (the
append-only log the row is a fold of). Attach tickets are **not a table**: a
Redis key with a 60-second expiry, which is shorter than any row's life. There
is no `jobs` table either — the desired state is the session row and the
outbox is already a durable queue. Accounts and runtime_vms come with later slices. The starter's
users, organization, member and role tables are the identity half of
this; a personal workspace is one organization with one owner member.

**`host` carries `ownerUserId` and no workspace id** (08): a machine
belongs to the person who paired it and every workspace they are in
borrows it. **There is no `host_keys` table** — the host's public key and
its fingerprint are columns on the host row, and the retired key joins
them as two more columns when rotation arrives on the link (09 §3);
rotation needs exactly two keys, never N, and every runner boot verifies
an assertion against that one row. The pairing token is a row of its own
because it is a credential that exists before its subject does: it
carries the same `ownerUserId`, the digest of its secret and nothing
recoverable, plus the address it was minted from and the address it was
spent from (F5).

The module exposes these, and which credential each accepts is the whole
of its authorization:

| Route | Credential |
|---|---|
| `GET /hosts`, `GET /hosts/{id}` | the person's, plus `read Host` and `hosts:read` |
| `POST /hosts/pairing`, `GET /hosts/pairing`, `DELETE /hosts/pairing/{id}` | the person's, plus `create`/`read`/`delete Host` and `hosts:*` — pairing is a Host verb, not a noun of its own |
| `PATCH /hosts/{id}`, `DELETE /hosts/{id}` | the person's: rename, and the console's unpair |
| `POST /hosts/register` | the registration token in the body, and nothing else |
| `DELETE /hosts/self` | the host's boot JWT as a bearer; the host is the token's subject, so the path names no id and a host can only ever remove itself |

Two routes therefore delete a host and they are not the same operation:
`DELETE /hosts/{id}` is a person unpairing a machine they own, guarded by
policies; `DELETE /hosts/self` is the machine saying it has been
uninstalled, guarded by the assertion alone. Both set `unpairedAt` and
neither deletes the row.

**The machine's own read of its host row is unscoped, by design.** A host
is not tenant-scoped and there is no person on that request to scope by:
it proves who it is with a signature. Every *person's* read goes through
the own-or-grant scoped repository, and anything that wants to run work
on a host — `sessions/` first — asks `HostAccessPort.assertUsable(scope,
hostId)`, which loads the host through that same scoped read and refuses
an unreachable or unpaired one as missing. That port, not the repository,
is what `hosts/` publishes.

## Open questions

1. Where is `docker compose up` meant to run for "hosted by us": one
   Hetzner cloud VM in Falkenstein running the compose stack, or a
   managed Postgres plus a container? Simplest is one VM.
2. Auth session storage: cookie with server session in Postgres, or a
   signed JWT? Cookie plus server session is simpler to revoke.
3. Webhook receiver placement: in the control plane process (it is
   public anyway in the MVP) or a separate tiny receiver as note 04
   suggests for the Tailscale-only future?
4. Relay fan-out: in-process only for the MVP, Redis when the relay
   splits. Confirm.
5. Backups: Postgres dump nightly to Hetzner object storage. Enough?
6. Where the release host lives, and whether it is the same origin as
   the install script (see "Hosting split"). Cheapest that is still
   honest: artifacts on object storage behind a CDN, the script beside
   them, the control plane elsewhere.
7. Replay-checking `jti` needs a store with a five-minute horizon.
   Redis, or accept the replay window within the token's lifetime?
