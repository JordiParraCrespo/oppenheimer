---
"@oppenheimer/api": patch
"@oppenheimer/backend-cache": minor
---

One Redis command connection for the API. The cache, the rate limiter and the
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
