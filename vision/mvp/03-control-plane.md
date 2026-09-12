# 03 — Control plane

## Decided

- One Node process (Hono, Drizzle, Postgres) with modules: identity,
  installations, hosts, sessions, accounts, events, relay, vault,
  scheduler. Split by process later; the relay first.
- Hosted in the same Hetzner region as the host. Joins the tailnet as a
  node for the runner link; public HTTPS for browsers.
- GitHub: one App with user authorization during installation. The
  installation is the access control. Per-session installation tokens
  narrowed to one repository, one-hour lifetime, rotated (note 09).
- The App private key lives in the secret store, never the database
  (F20). No vendor credential is ever stored (note 01 §7).
- Events are the source of truth per session; state is derived.
- Sleep scheduler operates on **runtime VMs**, not sessions. A runtime
  VM is either a Shared workspace VM (one per repo per host, holding
  many sessions) or a Clean VM (one session). The scheduler tracks the
  VM explicitly, computes idleness as "every session in this VM is
  idle", and only then drives the runner's sleep tiers (note 11 §2).
  Ephemeral sessions add the auto-push-and-destroy step at their own
  timeout, and an Ephemeral session in a Shared workspace VM only
  removes its worktree, never the shared VM.

## Data model, first cut

users, installations, repositories (cached from GitHub, refreshed by
webhook), hosts, host_keys, accounts, runtime_vms (host, repo or null,
kind shared or clean, sleep tier, last activity), sessions (runtime_vm,
worktree, lifetime, agent, account), session_events, attach_tickets,
jobs.

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
