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
  source IP is recorded and shown (F5). Pairing notifies the owner, once
  per host.
- `POST /api/v1/hosts/pairing` — mints the token and answers the install
  command, the agent prompt, and the installer's digest when the deployment
  published one. A person holds a small number of unspent tokens at once,
  and minting past that is refused; a replacement token retires the one it
  replaces in the same write.
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
  An unpaired host does not get a link, and one unpaired while connected
  loses it (01).
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

## Projects, as built

A project is a saved scope a person creates, and metadata only (10 has
the schema). Four routes:

- `POST /projects` — a name, the repositories (each with a base branch
  and whether a new session is offered it; at least one, one of them a
  default), a default host and agent, and instructions. Each repository
  is resolved live through the `github/` module's `RepositoryAccessPort`;
  a default host the caller cannot use is `HOSTS_001`. The slug is derived
  once from the name.
- `PATCH /projects/{id}` — any of those; the repositories are replaced as
  a whole set in one transaction with the project row, and a save that
  loaded before an archive landed finds nothing to update.
- `GET /projects`, `GET /projects/{id}` — with the repositories embedded.
- `DELETE /projects/{id}` — archives; refuses while sessions nobody has
  closed are listed in it, and fails closed when nothing can answer that.

Sessions reach projects through one read, `ProjectLookupPort.findOneById`,
which hides an archived project. `POST /sessions` requires `projectId`;
`POST /sessions/{id}/move` changes it, and nothing else — no host is told,
because nothing on a host names a project. A project's defaults are
offered by the console; the API never applies them, and a session may
check out repositories its project does not hold. A project's
instructions are stored and not yet delivered (01).

## Sessions, checkouts and the log

The work itself: `work_session`, `session_checkout` — which is also **where a
repository is remembered**, since there is no repository table — and the
append-only `work_session_event`.

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

**The log is the truth and the row is the fold.** `work_session.state` is a
projection, so the aggregate has no `setState` — its only mutator applies an
event — and a replay of any log rebuilds the row. `seq` is assigned by the
control plane under a row lock, never by the writer, so a buggy or hostile host
cannot create gaps; it is read in a **second statement after** that lock,
because under READ COMMITTED a statement's snapshot is taken before it blocks,
and the fold likewise re-reads the locked row rather than the instance the
caller loaded. Idempotency is per row — `<runId>:<n>` from a runner, the command
id from the API — and the append and the fold commit together. A link's
`events.append` batches are applied in the order they arrived, so the log's
order is the order the runner wrote. The log keeps kinds the fold does not act
on: `session.step` (01) moves only `lastEventAt`, and
`GET /sessions/{id}/events` is where the console reads it back. A runner's
refusal of a session command — a `command.failed` no attachment claims — goes on
that session's log through the same door: a refused create is `session.failed`
with the runner's code and detail, which moves the row off `starting`, and any
other refusal is `command.failed`, kept without folding.

**One action is one entry.** A command appends exactly one event in the
transaction that makes the row change it implies; what could not be delivered to
a host comes back as a `host_offline` hint on the response, not as a second
entry from a second writer.

**Creating a session sets how it is launched, and what it is for.**
`POST /sessions` takes the host, the agent, the checkouts and an optional
name, plus two fields the composer's foot row and text area set:

```ts
launch?: { model?: string, permission?: 'ask' | 'auto' | 'full', effort?: Effort }
prompt?: string                         // ≤ 2 KB of UTF-8, the cap 02 §7 already states
```

`launch` is **one object rather than four fields spelled four times**,
because the four travel together everywhere — the route body, the
`session.requested` payload, the `session.create` frame (01) and the
response. `agent` stays outside it: the agent is *what the session is*,
the launch is *how it was started*, and only the second is a thing a
later slice changes without making a different session. Permission
defaults to `ask` on the server as well as in the console, and `full` is
never seeded from a previous choice (05).

**The three launch options are folded onto `work_session`, for restart.**
Note 10 recorded a model in the log and said promoting it to a column
later would be *a replay, not a backfill*; this is that promotion, and
the reader that needs it is `restart`, which must relaunch a session the
way it was launched and would otherwise walk the whole log to find out.
The fold is not a second truth — every column on the row is already a
projection of its log — so `launchModel`, `launchPermission` and
`launchEffort` are three more fields of the fold, written by
`session.requested` and rebuilt exactly by a replay. No backfill:
existing rows are `ask` with no model, which is what they were launched
with. Changing them on a live session is a later slice and brings its own
event kind with its writer, never before.

**The first task is written once, by whichever end has it.** A `prompt`
on the create is appended as `prompt.first` in the same transaction as
the session row — one action, one entry — and rides `session.create` to
the host, which appends it to the agent's argv rather than typing it at a
running process (02 §5). A session created with no prompt is the other
case: the person types the first message themselves and the runner
reports it off the transcript (02 §7). Exactly one of the two writes the
entry, decided by whether the field was set, which is what keeps the log
honest without the two writers needing a shared key. It is stored nowhere
but the log and never returned on a list: a prompt is the person's own
sentence, and the log and the host are the two places it belongs.

**Three vocabularies.** The stored lifecycle is
`starting | open | failed | resolved` and answers *is this work finished* — so
stopping does not move it, and `resolved` is terminal. The agent's observations
(`working`, `blocked`, `idle`, `done`, `unknown`) are inputs. The **derived
group** is what the sidebar dot shows and is a function of the row: the
observation, when it was entered, and the report hashes are folded columns, so a
listing answers it without walking a log. Its debounce is measured from a
recorded transition, so no caller can claim a session has been stuck.

**Stop is a decision; restart and close are requests.** The control plane will
not dispatch a stopped session again, so stopping is the fact. Restarting and
closing need work on the host that can legitimately refuse — closing pushes
branches and will not remove a dirty worktree unless the caller accepted the
loss — so the API records the request and `session.restarted` / `session.closed`
come back from the host.

**The attach ticket is a Redis key**, not a table: `attach:<random>` →
`{sessionId, organizationId, window, userId}`, claimed with `SET … NX`, 60
seconds, single use. It travels in `Sec-WebSocket-Protocol` and never in the
query string, because proxies log request lines and this buys an interactive
shell. Opening a terminal is `update Session`: there is no `attach` verb, and
the scope split is what keeps a read-only credential out of a PTY.

**Archiving a project fails closed.** "Is any session still open here" is a
question only the module that owns sessions can answer, so it answers it through
a port that module registers; with nothing registered the archive refuses. The
check and the write share a transaction that locks the project row, and creating
a session takes a share lock on the same row, so an archive and a create cannot
both win.

**A session is named from its first prompt: a model if it is quick, the
prompt's own words if not.** A session keeps its minted slug until its first
prompt exists — from the composer at create, or reported off the transcript
later. A model is then asked for a short title, with a short deadline; when it
misses the deadline, fails, or the deployment has none, the title is the
prompt's own opening words, which needs no network and names the same prompt
the same way every time. The `session.named` entry records which it was:
`source` is `model` or `prompt`. Creating a session **waits for the name**,
asking the model while the host is told about the session, and returns it; the
runner's path does not wait. A derived title, from either source, never
overwrites a name a person typed, and that rule is in the fold; it is also
what stops a second naming, since the *first* prompt is the one it names from
and there is only one of those. The one line that leaves the host is the
person's own prompt.

## The relay, as built

The link's server half and the browser's attach socket, as two modules so
the dependency runs one way and neither `sessions/` nor `relay/` imports
the other:

- **`links/`** — the per-host link registry (in-process, open question 4)
  and `RelayDispatchAdapter`, the `SessionDispatchPort` implementation
  bound to `SESSION_DISPATCH`. `sessions/` imports it to dispatch;
  `relay/` imports it to register the sockets it accepts; it imports no
  module and no table, and knows the two through their ports and tokens.
  It **writes nothing**: `delivered` means the frame was queued on a live
  link, `host_offline` means the host holds none, and `not_supported`
  means the host is reachable and the operation has no frame on the wire
  yet (`addCheckout`, `removeCheckout` today) — so a caller is never
  handed a delivery that did not happen.
- **`relay/`** — the two sockets, mounted as `upgrade` listeners on the
  API's own HTTP server over `ws`, not as Nest gateways: neither is a
  request/response pair, and each takes its credential from the
  handshake where Nest's pipeline would not look. What it sees of the
  other modules is their published ports and nothing of their tables.

```
GET    /api/v1/relay/runner    Authorization: Bearer <boot JWT>   the runner link (01)
GET    /api/v1/relay/attach    Sec-WebSocket-Protocol: <ticket>   the browser attach socket (01)
```

**The runner link.** The boot assertion is verified through `hosts/`'
`HOST_ASSERTION` exactly once per dial (verifying burns the `jti`); a
socket presenting none is refused before the upgrade. The first frame must
be `hello` within 10 s. A runner whose range tops out below
`min_supported` is refused **with** `update_required`; one whose floor is
above this control plane's version is told `blocked` with a retry-after.
Then **`welcome`**: the protocol version, the fingerprint of the control
plane's signing key — the one registration returned, so the runner's pin
(F6) has something to compare against; a control plane with no signing
key refuses every upgrade rather than advertise an empty pin — and the
**epoch**, the reconnect generation the registry allocates per accepted
link on this host and both peers use from then on, so a log line on either
side names the same link. Every outbound frame is parsed through the same
union inbound frames are, so what this process sends is what the shared
package says it sends. A newer link from the same host replaces the older
one, whose socket is closed. Hello and every heartbeat record presence
through `HOST_PRESENCE`, the one writer of `lastSeenAt`, stamped with the
control plane's receipt time — never the runner's clock, which a skewed
host would use to take itself offline — and carrying the same
`hostFactsSchema` registration validated, which **replaces** what was
there. `events.append` goes through `RECORD_SESSION_EVENTS` and is
acknowledged by key. `credentials.token` is answered by `github/`'
`RepositoryAccessPort`, minted live and sealed to the host's key (F7:
Ed25519 → its X25519 twin, ephemeral ECDH, HKDF-SHA256, AES-256-GCM; the
runner's half opens it), or refused with a `command.failed` carrying the
ask's id. A dropped link closes its attachments with `host_offline`.

**Hello reconciliation** is `sessions/`' `SESSION_RECONCILIATION`, called
with the snapshot: a `starting` session on this host the runner does not
hold is dispatched again, with its prompt read back from the log (the
runner is idempotent by session id); an `open` one it does not hold is
recorded `session.stopped` with `source: api`, keyed by the runner's
`runId` so a replayed hello writes it once; anything the runner holds that
the rows do not know is logged and left alone.

**The attach socket.** The ticket in the subprotocol is redeemed with a
`GETDEL` (single use), and what it authorised is re-checked at redemption:
the session through `SESSION_LOOKUP`, which answers `live`, `stopped` or
`resolved` — three answers, because they end differently — and the
person's membership through `organizations/`' `WORKSPACE_LOOKUP`. Every
refusal after the handshake is a `closed` control frame naming the reason
and then a final close code on an **established** socket, never a refused
upgrade: a browser's WebSocket cannot see the status of a refused
upgrade, only a 1006 it would take for a dropped radio and retry. Only a
request with no ticket, or from an origin this API does not serve, is
refused before the upgrade. A stopped session closes with its own code, so
the console offers Restart rather than a reconnect ladder. Then the
session's host either holds a link — the relay allocates the attachment
id on it (01, open question 7), waits for the browser's viewport and sends
`session.attach` carrying it — or it does not, and the socket is told
`host_offline` and closed. PTY frames reach the browser bare; keystrokes
leave as bare binary frames and are copied onto the link under the
attachment id; a `resize` is per attachment; a `credit` is relayed as
`attachment.credit`; closing the tab frees the id and sends
`session.detach`.

The routes are guarded by the handshake rather than by a policy
decorator, so `route-policy-coverage.spec.ts` does not see them; the
gateway specs, which run both sockets on a real HTTP server, are the
coverage they get.

## Data model, first cut

users, installations, repositories (**not a table**: listed live from
GitHub through the installation; a repository is remembered only by the
checkout that took it, as GitHub's own id plus the installation and a
name snapshot), hosts, host pairing tokens, projects (a saved scope a
person creates: the repositories its sessions usually work on, each on a
base branch and marked default or not, and a default host, agent and
instructions — metadata only, so nothing on a host is named after it; see
10, changed 2026-09-26 from projects auto-created per repository),
**work_session**
(workspace, project, host, agent, slug, name, the checkout the agent runs
in, and the fold of its log) — a session is listed under one project and
can be moved to another, which moves nothing on a host —,
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
4. ~~Relay fan-out: in-process only for the MVP, Redis when the relay
   splits. Confirm.~~ Confirmed: `links/`' registry is an in-process map,
   and it is the one file that changes when the relay splits.
5. Backups: Postgres dump nightly to Hetzner object storage. Enough?
6. Where the release host lives, and whether it is the same origin as
   the install script (see "Hosting split"). Cheapest that is still
   honest: artifacts on object storage behind a CDN, the script beside
   them, the control plane elsewhere.
7. Replay-checking `jti` needs a store with a five-minute horizon.
   Redis, or accept the replay window within the token's lifetime?
