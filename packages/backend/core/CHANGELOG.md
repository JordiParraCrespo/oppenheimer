# @oppenheimer/backend-core

## 0.3.0

### Minor Changes

- a0e23bd: Operations are named by one factory and a collision fails generation; nullable enums list `null` (`nullableEnum`).
- eeaf30a: Remove the starter's unused exports and add the helpers the API repeated by hand.

  - Removed: the `Mapper` interface (the API's mappers use
    `@oppenheimer/backend-ddd`'s), `ZodValidationPipe` (the API registers
    `nestjs-zod`'s), `PaginatedRequest` and `paginationSchema` (use
    `paginationSchema` from `@oppenheimer/shared`, which reads `PAGINATION`),
    and the `RequestContextService` re-export (import it from
    `@oppenheimer/backend-ddd`).
  - Added: `toPageMeta(page)`, a paginated response's `meta` from a
    repository's `Paginated` result (`totalPages` is 0, never `Infinity`, for a
    limit of 0); `PaginatedResponseDto(Item, Meta)`, a base class for a
    paginated response DTO's `data` / `meta`; and `requireFound(option, error,
options?)`, the value of a lookup or the given `AppError`.

- 65a7b1c: Export `describeError(error: unknown): string`: an `Error`'s message, or any
  other thrown value as a string, for the log lines of best-effort paths.
- f099524: Add `CapabilitiesService`, which resolves the deployment's optional features from config once at boot.
- f099524: Add `ApiAuthProblemResponses()`, which documents the 401/403 every guarded route can produce.
- 3de723c: Open the request's correlation id in middleware, so a guard's refusal carries it.

  - Removed: `RequestContextInterceptor`. Guards run before interceptors, so a
    401, 403 or 429 a guard threw went out with no `correlationId`.
  - Added: `RequestContextMiddleware`, which the API applies to every route in
    `AppModule.configure`, and `resolveCorrelationId` / `isValidCorrelationId` /
    `CORRELATION_HEADER`. An inbound `x-correlation-id` is honoured only when it
    is 1–64 characters of `[A-Za-z0-9._:-]` (the first value of a repeated
    header); anything else becomes a fresh UUID.
  - `buildPinoHttpOptions` sets `genReqId`, so the request log's `req.id` is the
    correlation id (no longer pino's counter), and every response, including the
    Better Auth routes, echoes it as `x-correlation-id`.

- f099524: `LoggingModule` wraps `nestjs-pino` with hardened defaults — no headers, query strings or bodies in request lines — and attaches `userId` and the credential's effective scopes once the auth guards resolve.
- f099524: `AllExceptionsFilter` answers with `application/problem+json` and the RFC 7807 members, plus `code`, `correlationId`, `timestamp` and `invalidParams`, in place of `{ statusCode, code, message }`. A 5xx no longer echoes the underlying message.
- 024f31b: User and role search match `%` and `_` literally.

  - Added `likeContains(term)` to `@oppenheimer/backend-core`: an `ILIKE`
    contains-pattern with the term's `%`, `_` and `\` escaped.
  - `GET /v1/users?search=` and `GET /v1/roles?search=` use it, so `a_b` no
    longer matches `axb` and `%` no longer matches every row. `search` is trimmed
    and capped at 100 characters (documented as `maxLength` in the OpenAPI
    document; a longer term is a 400).

### Patch Changes

- 369c7f8: Authorization stops re-reading roles on every request.

  - `@oppenheimer/api`: a user's role-derived permissions are cached in Redis,
    keyed on three version counters read in one query per request — the
    organization's `roleVersion`, the new `role_catalog_version` (global roles)
    and `user_role_version` (a user's global assignments), added by migration
    `AddAuthzVersions`. Every role and assignment write bumps the counter that
    covers it in its own transaction, so a revocation is visible on the next
    request on every replica. Platform roles resolve from an in-process snapshot
    of the global roles; the access-scope interceptor reuses the role ids the
    ability was built from and reads team membership in one join. A warm
    guarded, scoped request makes 3 authorization queries instead of 6. Redis
    failing falls back to the database.
  - `@oppenheimer/backend-core`: `requestMemo(request, key, compute)`, one
    in-flight computation per key per request, evicted on rejection.
  - `@oppenheimer/backend-authz`: `ResolveScopeInput.roleIds`, optional, for a
    caller that already knows the roles.

- 64d3f7a: Remove the Stripe `billing` module and the `leads` example the project
  inherited from the Flama starter. Neither was ever composed into the API, so no
  endpoint a deployment served goes away; what goes is everything that existed
  only for them. Stripe billing can be brought back from the Flama starter's
  `billing` plugin, then `pnpm generate:api-client`.

  These are breaking changes for anything that imported the removed names, which
  is why the packages below take a minor bump while they are on 0.x.

  - `@oppenheimer/api` drops `src/billing`, `src/leads`, the `stripe` config and
    the `stripe` dependency, and the `stripe_billing` capability (and with it the
    property on `GET /health/capabilities`). The `lead`, `subscription` and
    `billing_customer` tables, which nothing ever wrote, are gone from the
    schema. The `STRIPE_*`
    variables leave `.env.example`.
  - `@oppenheimer/shared` drops the `billing` and `leads` scope resources and
    permission groups (so the `billing:*` and `leads:*` scopes), the
    `stripe_billing` deployment and client capability, the `Billing` subject, the
    `GET /billing/subscriptions` endpoint policy and the billing and lead schemas.
  - `@oppenheimer/api-client` drops the legacy `BillingApi` and `LeadsApi`
    services and their models, and the regenerated types no longer carry the
    removed scopes or `stripe_billing`.
  - `@oppenheimer/translations` drops the `BILLING_*` and `LEAD_*` error copy and
    the unused billing entry of the team page's permission areas.
  - `@oppenheimer/backend-core`: the capabilities registry's docs no longer use
    Stripe as their example.

- 8e2de68: `SanitizePipe` no longer rewrites custom route parameters. It rebuilds objects
  to strip HTML, which is right for a JSON body and destructive for anything a
  `createParamDecorator` read off the request: a `Map` came back as `{}` and a
  class instance lost its prototype, so a resolved access scope reached a
  repository with no `grants.get`. Bodies, query strings and route parameters are
  sanitized exactly as before.
- Updated dependencies [27af598]
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
- Updated dependencies [604707a]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [a880b19]
- Updated dependencies [7945f7e]
- Updated dependencies [3de723c]
- Updated dependencies [5a88302]
- Updated dependencies [09cea4c]
- Updated dependencies [f099524]
- Updated dependencies [7ed4e17]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [8e2de68]
- Updated dependencies [fc0e75d]
- Updated dependencies [88f7898]
- Updated dependencies [2202daa]
- Updated dependencies [5bd4a8b]
- Updated dependencies [ed28ce2]
- Updated dependencies [f099524]
- Updated dependencies [249b51b]
- Updated dependencies [1c2ae71]
- Updated dependencies [c3c7883]
- Updated dependencies [2d00e7e]
- Updated dependencies [e505b9e]
- Updated dependencies [0918701]
- Updated dependencies [a23b14e]
- Updated dependencies [173bb4c]
- Updated dependencies [9ffae03]
- Updated dependencies [38b511f]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [dcc5fe1]
- Updated dependencies [bbacd49]
- Updated dependencies [5b93fd7]
- Updated dependencies [f099524]
- Updated dependencies [8fab63d]
- Updated dependencies [064c443]
- Updated dependencies [bb3c4e8]
- Updated dependencies [ca05d90]
- Updated dependencies [f101364]
- Updated dependencies [8f5fd3d]
- Updated dependencies [097956a]
- Updated dependencies [b6676f8]
- Updated dependencies [a81af0d]
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
