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

## Data model, first cut

users, installations, repositories (cached from GitHub, refreshed by
webhook), hosts, host_keys, sessions (host, repo, base branch, branch,
worktree path, agent, state, name), session_events, attach_tickets,
jobs. Accounts and runtime_vms come with later slices. The starter's
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
