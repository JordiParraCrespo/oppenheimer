# @oppenheimer/backend-core

Cross-cutting NestJS primitives for the API: error model, exception filter,
validation/sanitization pipes, request-context plumbing, and pagination request
helpers. Depends on `@oppenheimer/backend-ddd`.

See `.agents/rules/nestjs-architecture.md` and `api-config.md` for how these are
wired into the API.

## What's inside

| Export                                                    | Purpose                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `AppError`, `ErrorDefinition`                             | Catalog error: code, stable title, per-occurrence detail                |
| `AllExceptionsFilter`                                     | Global filter rendering every exception as an RFC 7807 problem document |
| `ProblemDetails`, `buildProblemDetails`, `problemTypeFor` | The problem-document contract and its builders                          |
| `ProblemDetailsDto`, `ApiProblemResponse`                 | Swagger model + decorator for documenting failures                      |
| `ZodValidationPipe`                                       | Validates DTOs against Zod schemas (`nestjs-zod`)                       |
| `SanitizePipe`                                            | Input sanitization pipe                                                 |
| `RequestContextInterceptor` / `RequestContextService`     | Per-request context propagation                                         |
| `LoggingModule`, `buildPinoHttpOptions`                   | Hardened request logging (`nestjs-pino`): no headers/query/bodies       |
| `UserContextInterceptor`                                  | Attaches `userId` + credential scopes to the request log context        |
| `createAuthRouteLoggingMiddleware`                        | Request logging for Better Auth routes (its `middleware` option)        |
| `PaginatedRequest`, `paginationSchema`                    | Standard pagination query request                                       |
| `Mapper`                                                  | Domain ↔ persistence/response mapper interface                          |

## Usage

```ts
import {
  AllExceptionsFilter,
  AppError,
  ZodValidationPipe,
  PaginatedRequest,
} from "@oppenheimer/backend-core";

// The catalog message titles the problem type; `detail` describes this request.
throw new AppError(UserErrors.NOT_FOUND, { detail: `No user with id ${id}` });
```

Responses look like this (see the [error reference](https://oppenheimer.dev/errors)):

```json
{
  "type": "https://oppenheimer.dev/errors#user_001",
  "title": "User not found",
  "status": 404,
  "detail": "No user with id 3f1c…",
  "instance": "/api/v1/users/3f1c…",
  "code": "USER_001",
  "correlationId": "2b4f…",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
```

## Consumed by

`apps/api`, other `@oppenheimer/backend-*` packages.
