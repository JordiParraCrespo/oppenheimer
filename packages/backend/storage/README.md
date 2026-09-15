# @oppenheimer/backend-storage

Pluggable file storage for the API — a local filesystem driver for development
and an S3-compatible driver for production (`@aws-sdk/client-s3`, with presigned
URLs via `@aws-sdk/s3-request-presigner`).

## What's inside

- `StorageService` — abstract contract (the DI token consumers depend on).
- `LocalStorageService` — stores files on the local filesystem.
- `S3StorageService` — stores files in S3 / S3-compatible object storage.
- `StorageModule` — selects the driver from config and binds it to
  `StorageService`.

Follows the **pluggable service** pattern: abstract class → concrete
implementations → factory in the module.

## Usage

```ts
import { StorageModule, StorageService } from '@oppenheimer/backend-storage';

constructor(private readonly storage: StorageService) {}
```

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
```

## Consumed by

`apps/api`.
