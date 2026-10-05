# @oppenheimer/backend-cache

Redis cache abstraction for the NestJS API, backed by
[`ioredis`](https://github.com/redis/ioredis).

## What's inside

- `CacheService` — abstract cache contract (the DI token consumers depend on):
  `get`, `mget`, `set`, `del`, `getOrSet`, `setIfAbsent`, `take`.
- `RedisCacheService` — the concrete `ioredis`-backed implementation.
- `CacheModule` — a global NestJS module that binds `CacheService` to
  `RedisCacheService` over a client the app hands it (`registerAsync`).

This follows the project's **pluggable service** pattern: depend on the abstract
`CacheService`, and the module decides the implementation.

## Behaviour worth knowing

- **The package never owns the connection.** `CacheModule` is given an ioredis
  client and never builds, configures or quits it. In `apps/api` that client is
  `REDIS_CLIENT`, the fail-fast command connection `RedisModule` shares with the
  rate limiter and the health probe, and closes on shutdown.
- **Keys are namespaced.** Every key is written under a prefix (`cache:` by
  default), applied per command inside the service. Callers pass their own key
  (`attach:<ticket>`), and the cache stays apart from BullMQ's `bull:*` and the
  throttler's `throttle:*` in the same database. ioredis's client-level
  `keyPrefix` is not used: on a shared client it would rewrite everyone's keys.
- **No flush.** There is no `reset()`: the database also holds queued jobs and
  rate-limit counters. If dropping the cache is ever needed, it is
  `SCAN MATCH cache:* COUNT 500` plus `UNLINK` in batches, never a flush of the
  whole database.
- **`getOrSet` is single-flight per process.** Concurrent callers for one key
  share one loader call, so an expiring entry costs at most one load per
  replica. A failed Redis read falls through to the loader, a failed write is
  ignored, and a loader error is never cached.
- **`mget`** reads many keys in one `MGET`, answering `undefined` for each
  missing one.

## Usage

```ts
// app.module.ts
import { CacheModule } from '@oppenheimer/backend-cache';
import type Redis from 'ioredis';

@Module({
  imports: [
    CacheModule.registerAsync({
      inject: [REDIS_CLIENT],
      useFactory: (client: Redis) => ({ client, keyPrefix: 'cache:' }),
    }),
  ],
})
export class AppModule {}

// a consumer
import { CacheService } from '@oppenheimer/backend-cache';

constructor(private readonly cache: CacheService) {}

const repositories = await this.cache.getOrSet(`github:repositories:${id}`, 60, () =>
  this.github.listInstallationRepositories(id),
);
```

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
pnpm test    # vitest
```

## Consumed by

`apps/api`.
