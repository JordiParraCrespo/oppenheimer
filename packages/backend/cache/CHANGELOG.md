# @oppenheimer/backend-cache

## 0.3.0

### Minor Changes

- fda123f: A host's own desktop in the console: a Desktop tab beside a session and a Desktop page per host in Settings, watching until Take control, with Full screen. The host's owner shares it with `runner desktop on`; the runner signs in to the screen-sharing server on its loopback with credentials that stay on the host, and drops the browser's input until it takes control.
- 2e5879e: Observability for the bots, the cache and the logs. The API exports `bot_engine_*` metrics for every bot turn and completion (runs by how they ended, failures by kind, tokens with the prompt cache's share, duration, tool calls, retries) and `cache_reads_total` for the Redis cache (hits, misses, errors by namespace), with a Grafana dashboard and alerts for both. `LOG_FILE` also writes the API's log lines as JSON to a file, which `pnpm monitoring:up` now ships to Loki through Grafana Alloy, and `pnpm logs` queries with LogQL. `@oppenheimer/backend-cache` takes an `onRead` observer; `@oppenheimer/backend-core`'s logging takes a `file`.
- 1ee269e: Rate limits are kept before the provider says them, and a bot treats one as
  a wait.

  - `@oppenheimer/backend-core`: `UpstreamLimiter` takes a `budget` (units a
    window per bucket) and `exchange` a call's `cost`; a call the window cannot
    hold pauses the bucket until the window ends and is refused without being
    sent, shared across replicas through the store's `incrementBy`.
    `GoogleOAuthClient.fetch` takes the call's units. `upstreamRateLimitOf`
    reads `{ system, resetAt }` back off any integration's rate-limit problem.
  - `@oppenheimer/backend-cache`: `CacheService.incrementBy`, one atomic add
    that sets the TTL of a new key.
  - `@oppenheimer/api`: Gmail spends each call's quota units from 12,000 a
    minute per account. A bot's tool answers a rate limit as who is limiting,
    until when, and not to retry in the turn, without the provider's text; a
    bulk Gmail write the limit stopped partway answers what it changed and what
    it did not reach; and a goal's next turn waits for the limit's end instead
    of running into it again.

## 0.2.0

### Minor Changes

- 942e8dc: One Redis command connection for the API. The cache, the rate limiter and the
  health probe share `REDIS_CLIENT` (`RedisModule`), which fails fast during a
  Redis outage (no offline queue, one retry, 1 s command timeout) instead of
  hanging requests, and is closed on shutdown. Every Redis client, BullMQ's and
  the standalone email queue's included, reads its address from the one `redis`
  config section (`redisConnectionOptions`). The rate limiter runs its script by
  hash (`EVALSHA`) instead of sending it on every request, and the GitHub
  repository picker shares one listing between concurrent requests.

  `@oppenheimer/backend-cache`: `CacheModule.register()` is replaced by
  `CacheModule.registerAsync({ inject, useFactory: () => ({ client, keyPrefix }) })`
  and `RedisCacheService` takes the ioredis client instead of building one; the
  package no longer owns or closes a connection. Every key is written under a
  prefix (`cache:` by default). `reset()` (`FLUSHDB` on the database BullMQ also
  uses) is removed. New: `mget` and `getOrSet`, single-flight per process.

- bbacd49: Build the runner ↔ control-plane link so a session can be created and run from the console.

  - API: `relay/` mounts the two sockets of the protocol on the API's own HTTP server — the runner link (`GET /api/v1/relay/runner`, boot assertion as bearer, hello/welcome, heartbeat → host presence, `events.append` → the session log, acked by key) and the browser attach socket (`GET /api/v1/relay/attach`, single-use ticket as the subprotocol, re-checked against the session and the workspace membership). `links/` holds the per-host link registry and the real `SessionDispatchPort`, replacing the pending adapter.
  - Runner: `internal/link` dials out with a per-dial EdDSA boot token, pins the control plane's key fingerprint from `welcome`, reconnects through the ladder with an epoch, streams PTY reads as attachment-id-prefixed frames and reports events with `<runId>:<n>` keys, resending what was not acked. `session.create` maps the structured launch onto the agent's argv through the catalog mirror; the sessions service gained `Stop` and a caller-provided id.
  - Web: `SessionStream` is the real transport over the attach socket, minting a fresh ticket per (re)connect; the terminal shows `offline` while the host holds no link.
  - Credentials: `credentials.token` is answered with a `credentials.grant` sealed to the host's key (Ed25519 → X25519, ephemeral ECDH, HKDF, AES-256-GCM); the runner's git credential helper pulls the token over the link, unseals it and holds it in memory until expiry or `credentials.revoke`. Hello reconciliation re-dispatches a launch the host never carried out and records stopped a session it lost. `attachment.credit` pauses PTY reads at 256 KB in flight; `host.preflight` and `host.update` are handled.
  - Shared: the protocol gains `welcome`, `session.stop`, `session.detach`, `command.failed`, `attachment.closed` and the attach socket's own vocabulary; `CacheService` gains `take()` (`GETDEL`).

- 818f20c: `GITHUB_015` and `CALENDAR_010` are 429s with `Retry-After`, declared on every route that reaches GitHub or Google. `@oppenheimer/backend-core` gains `UpstreamLimiter` and `AppError.retryAfterSeconds`; `@oppenheimer/backend-cache` gains `CacheService.setMax`.

### Patch Changes

- 8e2de68: Add `setIfAbsent(key, value, ttlSeconds)` — `SET … EX … NX` in one round trip.
  `get`-then-`set` is a race two callers can both win, so anything that must
  happen exactly once (a replay guard, a one-shot credential) could not be built
  on the previous surface.
