---
"@oppenheimer/api": patch
---

Security hardening follow-ups.

- `POST /v1/sessions/{id}/attach-ticket` and `POST /v1/sessions/{id}/restart`
  answer `404 HOSTS_001` when the caller can no longer use the session's host
  (a revoked grant, an unpaired host). Redeeming a ticket checks it too, and
  an open attachment is judged again every minute (session state, workspace
  membership, account standing, host access) and closed with the matching
  reason and code when refused; a check that throws keeps the socket.
- A GitHub webhook body replayed under a new `X-GitHub-Delivery` is the
  delivery already stored: `inbound_delivery.payloadDigest` (SHA-256 of the
  raw bytes) is unique per source. Events older than the delivery retention
  window are dropped when a delivery is processed.
- `installation` suspend/unsuspend webhooks apply in the order of GitHub's own
  timestamp (`github_installation.statusChangedAt`), so a late retry cannot
  undo a newer change; `suspendedAt` holds GitHub's time.
- `inbound_delivery.eventCount` is the total of the delivery's events, so a
  re-run no longer resets it to 0.
- The automation prompt's untrusted-data envelope escapes its attributes and
  carries `<`, `>` and `&` in the JSON as `\u` escapes, so the event's text
  can never close it.
- Bull Board stays off with a password shorter than 16 characters, with a
  warning at boot.
- A banned or deactivated owner's host is refused at the runner link
  handshake and its open link is closed by a heartbeat within a minute; a session's
  git token is not minted for a creator who may not act.
- A ban or unban made straight through Better Auth
  (`/api/auth/admin/ban-user`, `/unban-user`) rotates the account's
  delegated-session generation, as `AdminService` already did.
