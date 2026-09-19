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

- `POST /v1/hosts/register` — spends a one-hour single-use registration
  token and answers with the host id, the control plane's key
  fingerprint (which the runner pins from then on), the release channel
  and the release base URL. Unauthenticated apart from the token; the
  source IP is recorded and shown (F5).
- `DELETE /v1/hosts/{id}` — uninstall, authenticated by the host's boot
  JWT rather than by the spent registration token.
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

## Data model, first cut

users, installations, repositories (**not a table**: listed live from
GitHub through the installation; a repository is remembered only by the
checkout that took it, as GitHub's own id plus the installation and a
name snapshot), hosts, host_keys, projects (the body of work a session
belongs to; auto-created from the first repository a session checks out,
and found again by that repository's GitHub id; its slug is a directory
name on every host and is never reissued), sessions (host, **project**,
repo, base branch, branch, worktree path, agent, state, name) — a session
belongs to a project —, session_events, attach_tickets, jobs. Accounts and runtime_vms come with later slices. The starter's
users, organization, member and role tables are the identity half of
this; a personal workspace is one organization with one owner member.

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
