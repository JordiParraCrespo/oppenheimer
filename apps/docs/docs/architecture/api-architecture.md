---
sidebar_position: 3
---

# API Architecture

The NestJS API (`apps/api`) is a **Domain-Driven Hexagon**: dependencies point
inward, each use case is a vertical slice, and everything that talks to the
outside world does so through a port.

:::info The contract is in the repository, and it is checked
`apps/api/ARCHITECTURE.md` is the source of truth for how a module is cut —
the closed set of layer directories, what each may hold, and what a file in it
may be called. It is executable as `pnpm check:api-structure`, with the import
rules in `apps/api/.dependency-cruiser.cjs` (`pnpm arch`) beside it.

This page describes what the API *does*. It deliberately does not restate that
table: a second copy would drift from the one CI enforces.

Two modules are not there yet. `admin/` and `organizations/` are the
delegating Better Auth façades and still carry the pre-contract layout — a
root-level service behind a multi-route controller — which
`check-api-structure.mjs` reports and carries on a ledger rather than
excusing. They are being cut into use-case slices over gateway ports; until
then they are not the example to copy (`users/` and `profile/` are). See
`apps/api/AGENTS.md`.
:::

## Module structure

Every module under `src/` is cut the same way, and a directory appears only
once it has something to hold:

```
apps/api/src/<module>/
├── domain/              # aggregates, value objects, events, errors — pure
├── database/            # ORM model, repository port, TypeORM adapter
├── infrastructure/      # ports + adapters for everything else outside
├── commands/<use-case>/ # a write: command, handler, controller, request DTO
├── queries/<use-case>/  # a read: query, handler, controller
├── application/         # needs ports, is not a use case
├── dtos/                # the response contracts it publishes
├── guards/ decorators/ interceptors/   # inbound adapters
├── probes/              # liveness / readiness, for modules that have them
├── <module>.mapper.ts   # domain ↔ persistence ↔ response
├── <module>.di-tokens.ts
└── <module>.module.ts
```

There is **no `services/` directory**, and no service at a module root. A thing
is domain logic, a port, an adapter, or a use case.

## Auth module

Authentication is handled by [Better Auth](https://www.better-auth.com/),
mounted into NestJS via [`@thallesp/nestjs-better-auth`](https://github.com/ThallesP/nestjs-better-auth).
The Better Auth instance lives in `auth/infrastructure/better-auth.config.ts` and is registered in
`AppModule` with `AuthModule.forRoot({ auth })`.

### Configuration (`auth/infrastructure/better-auth.config.ts`)

| Feature            | Setup                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Database           | Native Postgres adapter over the shared `pg` pool                     |
| Email / password   | `emailAndPassword` with `sendResetPassword` → BullMQ email queue      |
| Email verification | `emailVerification.sendVerificationEmail` → BullMQ email queue        |
| Social providers   | Google + GitHub (`socialProviders`), enabled when env vars are set    |
| Mobile             | `@better-auth/expo` plugin (SecureStore cookie + deep-link callbacks) |
| Custom user fields | `firstName`, `lastName`, `role`, `isActive` (additional fields)       |
| Welcome email      | `databaseHooks.user.create.after` → BullMQ email queue                |

### Endpoints

Better Auth exposes its own handler under `/api/auth/*` (sign-in/up, sign-out,
OAuth callbacks, password reset, email verification, session). Sessions are
**cookie-based**: an httpOnly cookie on web, and a SecureStore-backed cookie on
mobile via the Expo plugin.

### Sessions & guards

`@thallesp/nestjs-better-auth` provides the `AuthGuard` (attaches `req.user` /
`req.session`) and the `@Session()` decorator. The global guard is disabled
(`disableGlobalAuthGuard: true`); protected controllers opt in explicitly.

### Authorization

CASL-based authorization via `PoliciesGuard` + `@CheckPolicies()` decorator,
layered on top of Better Auth's `AuthGuard`:

```typescript
@UseGuards(AuthGuard, PoliciesGuard)
@CheckPolicies({ action: 'read', subject: 'User' })
@Get()
findAll() { ... }
```

The user `role` is stored as a Better Auth additional field and read from the
session. Permissions are defined in `packages/shared` and shared with the
frontend.

## Users module

`users/` is the reference implementation of the contract — read it when a
shape is unclear.

### Mapper

`UserMapper` implements `Mapper<UserEntity, UserOrmEntity, UserResponseDto>`:

- `toPersistence()` — domain entity → ORM record, writing only app-owned columns
- `toDomain()` — ORM record → domain entity
- `toResponse()` — domain entity → response DTO, never leaking sensitive fields

### Routes

Each is its own slice under `commands/` or `queries/`, with one controller:

| Route                      | CASL policy | Slice                            |
| -------------------------- | ----------- | -------------------------------- |
| `GET /v1/users`            | read User   | `queries/find-users/`            |
| `GET /v1/users/:id`        | read User   | `queries/find-user-by-id/`       |
| `GET /v1/users/me`         | —           | `queries/get-me/`                |
| `PATCH /v1/users/:id`      | update User | `commands/update-user/`          |
| `DELETE /v1/users/:id`     | delete User | `commands/delete-user/`          |

## Authentication & sessions

Authentication is handled by [Better Auth](https://better-auth.com) (mounted via
`@thallesp/nestjs-better-auth`), not a custom JWT service. Sessions are
**cookie-based** — the API sets an httpOnly session cookie; there is no
app-managed access/refresh token pair. Better Auth also provides:

- **Super-admin** (`admin` plugin): list/ban/impersonate users, set roles,
  revoke sessions — gated by the `superadmin` / `admin` roles under
  `/api/auth/admin/*`.
- **Organizations, members & invitations** (`organization` plugin): sign-up
  creates an account and nothing else — an account belongs to no organization
  until it creates one (`POST /v1/organizations`, which makes the caller its
  owner) or accepts an invitation; invitations are emailed via the queue.
- **Workspaces** (org plugin teams): `team` / `teamMember`, scoped to an org.

CASL remains the authorization engine for the app's own REST routes (see the
roles/RBAC docs); Better Auth's plugin roles only gate the `/api/auth/*` surface.

## Event-driven processing

Domain events are raised by aggregates and staged on a **transactional
outbox** by the repository, inside the same transaction as the write — so the
state change and the events it owes commit or roll back together:

```
UserEntity.delete() raises UserDeletedDomainEvent
  → repository stages it on the outbox in the same transaction
  → commit → relay delivers it → @OnEvent handler → Email Queue → Processor
```

The relay claims due rows with `FOR UPDATE SKIP LOCKED`, so concurrent API
replicas lease disjoint rows. Delivery failures retry with backoff and park as
`failed` rather than being dropped. BullMQ still owns retries, delayed jobs and
concurrency for the queued work itself; the outbox solves only the one thing it
cannot — atomicity with the database transaction.

## Error catalog

Each module declares its errors in `domain/<module>.errors.ts` and throws them
as `AppError` from `@oppenheimer/backend-core`. The global `AllExceptionsFilter`
renders every one as an **RFC 7807 problem document** served as
`application/problem+json` — see the [error reference](../errors.md) for the
full catalog and the response shape.

```typescript
// domain/user.errors.ts — the catalog message is the problem *title*
export const UserErrors = {
  NOT_FOUND: { code: "USER_001", message: "User not found", httpStatus: 404 },
} as const satisfies Record<string, ErrorDefinition>;

// a handler — what varies per request is the problem *detail*
throw new AppError(UserErrors.NOT_FOUND, { detail: `No user with id ${id}` });
```

Document the failure on the endpoint so it reaches the OpenAPI document and the
generated client:

```typescript
@ApiProblemResponse({ status: 404, description: 'User not found', code: 'USER_001' })
```

## Health checks

| Route         | Type      | Checks                                                  |
| ------------- | --------- | ------------------------------------------------------- |
| `GET /health` | Liveness  | Memory heap < 200MB                                     |
| `GET /ready`  | Readiness | Database ping, Redis ping, memory heap, disk > 10% free |

`RedisHealthIndicator` is a custom ioredis-based health check (NestJS Terminus doesn't include one by default).

## Bootstrap order (`main.ts`)

1. Pino logger (structured JSON, pretty-print in dev)
2. Helmet (security headers)
3. CORS (origin from `app.frontendUrl`)
4. Global prefix `/api`
5. URI versioning (`v1`)
6. Global pipes: `SanitizePipe`, `ZodValidationPipe`
7. Swagger at `/api/docs`
8. Bull Board at `/admin/queues`

## Configuration

6 config factories, all Zod-validated:

| Config     | Key env vars                                                                           |
| ---------- | -------------------------------------------------------------------------------------- |
| `app`      | `PORT`, `NODE_ENV`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_ADMIN_USER_IDS`, `FRONTEND_URL` |
| `database` | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`                      |
| `redis`    | `REDIS_HOST`, `REDIS_PORT`                                                             |
| `email`    | `EMAIL_PROVIDER`, `EMAIL_FROM`, `SMTP_*`, `RESEND_API_KEY`                             |
| `oauth`    | `GOOGLE_CLIENT_ID/SECRET/CALLBACK`, `GITHUB_CLIENT_ID/SECRET/CALLBACK`                 |
| `storage`  | `STORAGE_PROVIDER`, `UPLOAD_DIR`, `S3_*`                                               |
