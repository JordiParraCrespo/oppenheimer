# @oppenheimer/backend-cache — Agent Instructions

Redis cache abstraction for the NestJS API.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).

## Layout

```
src/
├── cache.module.ts              # global NestJS module (registerAsync, given a client)
├── cache.service.ts             # abstract CacheService (the port)
├── redis-cache.service.ts       # Redis-backed implementation
├── redis-cache.service.spec.ts  # against a fake client
└── index.ts
```

## Conventions

- **Pluggable service pattern**: abstract `CacheService` → concrete
  implementation → provided through `CacheModule`. Add new backends as another
  concrete class wired in the module, keeping the abstract contract stable.
- **The package never owns the connection.** `CacheModule.registerAsync` is
  handed an ioredis client; nothing here constructs, configures or `quit()`s
  one. In `apps/api` it is the shared `REDIS_CLIENT`.
- **Every key is prefixed inside the service** (`cache:` by default). Never
  use ioredis's client-level `keyPrefix`: the client is shared, and it would
  rewrite the rate limiter's keys too. Callers keep passing unprefixed keys.
- **No flush, ever.** The database also holds BullMQ jobs and rate-limit
  counters. Anything that must drop cache entries scans the prefix and
  `UNLINK`s in batches.
- A new method goes on the abstract `CacheService` first, so every fake must
  provide it.
- Never put a secret in a key; hash it (see `scopes-and-credentials.md`).
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-cache build
pnpm --filter @oppenheimer/backend-cache dev
pnpm --filter @oppenheimer/backend-cache test
```
