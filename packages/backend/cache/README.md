# @oppenheimer/backend-cache

Redis cache abstraction for the NestJS API, backed by
[`ioredis`](https://github.com/redis/ioredis).

## What's inside

- `CacheService` — abstract cache contract (the DI token consumers depend on).
- `RedisCacheService` — the concrete `ioredis`-backed implementation.
- `CacheModule` — NestJS module that binds `CacheService` to `RedisCacheService`
  and reads connection config from `@nestjs/config`.

This follows the project's **pluggable service** pattern: depend on the abstract
`CacheService`, and the module decides the implementation.

## Usage

```ts
// module
import { CacheModule } from '@oppenheimer/backend-cache';

@Module({ imports: [CacheModule] })
export class AppModule {}

// service
import { CacheService } from '@oppenheimer/backend-cache';

constructor(private readonly cache: CacheService) {}
```

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
```

## Consumed by

`apps/api`.
