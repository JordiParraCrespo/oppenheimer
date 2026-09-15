# @oppenheimer/backend-cache — Agent Instructions

Redis cache abstraction for the NestJS API.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).

## Layout

```
src/
├── cache.module.ts          # NestJS module (register/registerAsync)
├── cache.service.ts         # abstract CacheService (the port)
├── redis-cache.service.ts   # Redis-backed implementation
└── index.ts
```

## Conventions

- **Pluggable service pattern**: abstract `CacheService` → concrete
  implementation → provided through `CacheModule`. Add new backends as another
  concrete class wired in the module, keeping the abstract contract stable.
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-cache build
pnpm --filter @oppenheimer/backend-cache dev
```
