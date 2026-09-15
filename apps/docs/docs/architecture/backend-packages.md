---
sidebar_position: 2
---

# Backend Packages

The backend is split into reusable packages under `packages/backend/`. Each follows a **pluggable service pattern**: an abstract class defines the interface, concrete implementations provide behavior, and a `@Global` DynamicModule with a factory reads config to select the active implementation at runtime.

## `@oppenheimer/backend-core`

Cross-cutting concerns shared across all NestJS apps.

| Export                                      | Purpose                                                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `AppError`                                  | Catalog error — an `HttpException` carrying a `code`, a stable title and a per-occurrence `detail`                   |
| `AllExceptionsFilter`                       | Global filter rendering every exception as an [RFC 7807 problem document](../errors.md) (`application/problem+json`) |
| `ProblemDetailsDto` / `ApiProblemResponse`  | Swagger model + decorator for documenting error responses                                                            |
| `RequestContextInterceptor`                 | Sets a correlation ID per request via `AsyncLocalStorage`                                                            |
| `RequestContextService`                     | Static wrapper — `run()`, `getCorrelationId()`, `setCorrelationId()`                                                 |
| `Mapper<Entity, ServiceModel, ResponseDto>` | 3-layer mapper interface with `toRepository`, `toService`, `toController`                                            |
| `SanitizePipe`                              | Recursively strips HTML tags from all string inputs                                                                  |
| `ZodValidationPipe`                         | Validates input against Zod schemas (reads `zodSchema` static property)                                              |
| `PaginatedRequest`                          | Zod schema for `page` (int >= 1) and `limit` (int 1-100)                                                             |

### Usage in `app.module.ts`

```typescript
import {
  AllExceptionsFilter,
  RequestContextInterceptor,
} from "@oppenheimer/backend-core";

@Module({
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
  ],
})
export class AppModule {}
```

## `@oppenheimer/backend-email`

Pluggable email service with React Email templates.

### Implementations

| Class                    | When to use                                                |
| ------------------------ | ---------------------------------------------------------- |
| `ConsoleEmailService`    | Development — logs email content to console                |
| `NodemailerEmailService` | SMTP — renders React templates, sends via nodemailer       |
| `ResendEmailService`     | Production — renders React templates, sends via Resend API |

### Templates

Located in `src/templates/`, built with `@react-email/components`:

- `password-reset.tsx` — Reset button + fallback link
- `email-verification.tsx` — Verify button + fallback link
- `welcome.tsx` — Welcome message with user's name

### Configuration

Set `EMAIL_PROVIDER` to `console`, `nodemailer`, or `resend`.

```typescript
import { EmailModule } from "@oppenheimer/backend-email";

@Module({
  imports: [EmailModule.register()],
})
export class AppModule {}
```

## `@oppenheimer/backend-cache`

Redis cache abstraction.

| Method  | Signature                                                    |
| ------- | ------------------------------------------------------------ |
| `get`   | `get<T>(key: string): Promise<T \| null>`                    |
| `set`   | `set<T>(key: string, value: T, ttl?: number): Promise<void>` |
| `del`   | `del(key: string): Promise<void>`                            |
| `reset` | `reset(): Promise<void>`                                     |

```typescript
import { CacheModule } from "@oppenheimer/backend-cache";

@Module({
  imports: [CacheModule.register()],
})
export class AppModule {}
```

## `@oppenheimer/backend-storage`

File storage abstraction with local filesystem and S3 implementations.

| Method         | Signature                                                              |
| -------------- | ---------------------------------------------------------------------- |
| `upload`       | `upload(file: Buffer, key: string, mimeType: string): Promise<string>` |
| `delete`       | `delete(key: string): Promise<void>`                                   |
| `getSignedUrl` | `getSignedUrl(key: string, expiresIn?: number): Promise<string>`       |

Set `STORAGE_PROVIDER` to `local` or `s3`.

```typescript
import { StorageModule } from "@oppenheimer/backend-storage";

@Module({
  imports: [StorageModule.register()],
})
export class AppModule {}
```

## `@oppenheimer/backend-queue`

BullMQ async job processing with Bull Board admin UI.

```typescript
import { setupBullBoard } from "@oppenheimer/backend-queue";
import { QUEUE_NAMES } from "@oppenheimer/shared";

// In main.ts bootstrap
setupBullBoard(app, [QUEUE_NAMES.EMAIL, QUEUE_NAMES.FILE_PROCESSING]);
```

Bull Board UI is available at `/admin/queues`.

## CJS compatibility

All backend packages export both ESM and CJS:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  }
}
```

This is required because NestJS runs in CommonJS mode.
