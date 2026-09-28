# @oppenheimer/backend-storage — Agent Instructions

Pluggable file storage (local filesystem or S3) for the NestJS API.

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) and
> [`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).

## Layout

```
src/
├── storage.module.ts        # NestJS module + factory
├── storage.service.ts       # abstract StorageService (the port)
├── local-storage.service.ts # local filesystem implementation
├── s3-storage.service.ts    # S3-compatible implementation
└── index.ts
```

## Conventions

- **Pluggable service pattern**: abstract `StorageService` → concrete
  implementations (local / S3) → chosen by the factory in `StorageModule`.
  Add a backend as another concrete class; keep the abstract contract stable.
- **`upload` resolves to the key on every back-end**, and `getUrl` is the only
  way to a URL. Callers persist keys; a URL (signed and expiring on S3) is
  derived at read time.
- Ships **CommonJS**.

## Commands

```bash
pnpm --filter @oppenheimer/backend-storage build
pnpm --filter @oppenheimer/backend-storage dev
```
