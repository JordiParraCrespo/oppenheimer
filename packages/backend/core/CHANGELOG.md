# @oppenheimer/backend-core

## 0.3.0

### Minor Changes

- f099524: Add `CapabilitiesService`, which resolves the deployment's optional features from config once at boot.
- f099524: Add `ApiAuthProblemResponses()`, which documents the 401/403 every guarded route can produce.
- f099524: `LoggingModule` wraps `nestjs-pino` with hardened defaults — no headers, query strings or bodies in request lines — and attaches `userId` and the credential's effective scopes once the auth guards resolve.
- f099524: `AllExceptionsFilter` answers with `application/problem+json` and the RFC 7807 members, plus `code`, `correlationId`, `timestamp` and `invalidParams`, in place of `{ statusCode, code, message }`. A 5xx no longer echoes the underlying message.

### Patch Changes

- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/backend-ddd@0.3.0

## 0.2.0

### Minor Changes

- aa0eefd: Refactor the API toward Domain-Driven Hexagon architecture.

  - Add `@oppenheimer/backend-ddd`, a building-blocks package with `Entity`,
    `AggregateRoot`, `ValueObject`, `DomainEvent`, `CommandBase`, `QueryBase`,
    the `RepositoryPort`/`Paginated` abstractions, a domain/persistence/response
    `Mapper` interface, domain exceptions and `Guard`.
  - Restructure the users module into vertical slices (`commands/`, `queries/`,
    `domain/`, `database/`, `dtos/`, `application/`) on top of `@nestjs/cqrs`,
    with a `UserEntity` aggregate, an `Email` value object, a
    `UserRepositoryPort` and its TypeORM adapter, and domain-event publishing.
  - Invert the `@oppenheimer/backend-ddd` ↔ `@oppenheimer/backend-core` layering: the
    framework-free `RequestContextService` and the `ErrorDefinition` contract now
    live in `@oppenheimer/backend-ddd` (re-exported from `@oppenheimer/backend-core` for
    backwards compatibility), so the domain layer depends on no infrastructure.
  - Document the architecture in `apps/api/ARCHITECTURE.md`, add a
    `/scaffold-module` skill, and enforce the layer boundaries with
    dependency-cruiser (`pnpm arch`, wired into CI and a Stop hook).

### Patch Changes

- Updated dependencies [aa0eefd]
  - @oppenheimer/backend-ddd@0.2.0
