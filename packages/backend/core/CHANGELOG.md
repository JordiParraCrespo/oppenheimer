# @oppenheimer/backend-core

## 0.3.0

### Minor Changes

- f099524: Add `CapabilitiesService`, which resolves the deployment's optional features from config once at boot.
- f099524: Add `ApiAuthProblemResponses()`, which documents the 401/403 every guarded route can produce.
- f099524: `LoggingModule` wraps `nestjs-pino` with hardened defaults — no headers, query strings or bodies in request lines — and attaches `userId` and the credential's effective scopes once the auth guards resolve.
- f099524: `AllExceptionsFilter` answers with `application/problem+json` and the RFC 7807 members, plus `code`, `correlationId`, `timestamp` and `invalidParams`, in place of `{ statusCode, code, message }`. A 5xx no longer echoes the underlying message.

### Patch Changes

- 64d3f7a: Remove the Stripe `billing` module and the `leads` example the project
  inherited from the Flama starter. Neither was ever composed into the API, so no
  endpoint a deployment served goes away; what goes is everything that existed
  only for them. Stripe billing can be brought back from the Flama starter's
  `billing` plugin, then `pnpm generate:api-client`.

  These are breaking changes for anything that imported the removed names, which
  is why the packages below take a minor bump while they are on 0.x.

  - `@oppenheimer/api` drops `src/billing`, `src/leads`, the `stripe` config and
    the `stripe` dependency, and the `stripe_billing` capability (and with it the
    property on `GET /health/capabilities`). A new migration,
    `1789600000000-DropBillingAndLeads`, drops the `lead`, `subscription` and
    `billing_customer` tables, which nothing ever wrote; the migrations that
    created them stay, since deployed databases have run them. The `STRIPE_*`
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
- Updated dependencies [cb56034]
- Updated dependencies [f099524]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [a880b19]
- Updated dependencies [7945f7e]
- Updated dependencies [f099524]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [8e2de68]
- Updated dependencies [5bd4a8b]
- Updated dependencies [ed28ce2]
- Updated dependencies [f099524]
- Updated dependencies [a23b14e]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [bbacd49]
- Updated dependencies [f099524]
- Updated dependencies [8fab63d]
- Updated dependencies [bb3c4e8]
- Updated dependencies [f101364]
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
