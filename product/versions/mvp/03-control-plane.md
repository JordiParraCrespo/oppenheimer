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
