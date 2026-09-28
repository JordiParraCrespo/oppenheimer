---
"@oppenheimer/api": patch
---

Better Auth sessions are cached in Redis, and each credential is resolved once
per request.

- `secondaryStorage` over the shared `REDIS_CLIENT`, keyed `ba:<sha256>` so no
  session token is a key name; sessions are still written to (and revoked
  from) the `session` table, which answers whenever Redis misses or is down.
  A cookie request no longer reads the `session` table; a bearer session token
  costs one OAuth lookup instead of three queries.
- Every session row Better Auth deletes drops its cached copy first, and a
  revocation that cannot reach Redis fails instead of half-succeeding.
- New `SESSION_CACHE` port: deactivation, profile and avatar edits, a removed
  member, the provisioned personal workspace and account deletion refresh or
  drop the cached copies in the same request. "Sign out other devices" also
  sweeps sessions Better Auth's cache index never knew.
- The rate limiter keys a bearer by a digest of the secret and a browser by its
  signed session cookie, with no database or Better Auth call; refused
  credentials count against their IP (30 a minute, then `RATE_001`).
- Delegated sessions for scoped credentials are minted only on routes marked
  `@UsesBetterAuthSession()`, and read in one Redis round trip.
- An API token's `lastUsedAt` is written at most once a minute, by a guarded
  update that leaves `updatedAt` alone.
