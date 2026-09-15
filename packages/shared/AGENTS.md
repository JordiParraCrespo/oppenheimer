# @oppenheimer/shared — Agent Instructions

Cross-cutting contracts shared between backend and frontend: Zod schemas,
types, constants, and CASL permission helpers.

> Read the root [`CLAUDE.md`](../../CLAUDE.md). The RBAC rules in
> [`.agents/rules/rbac-roles.md`](../../.agents/rules/rbac-roles.md) also scope
> this package.

## Layout

```
src/
├── schemas/       # Zod schemas — single source of truth for DTOs
├── types/         # shared TS types
├── constants/     # shared constants
├── permissions/   # CASL ability helpers
└── index.ts
```

## What lives here

- **Zod schemas** are the single source of truth for DTOs. Define once here;
  the API validates against them and the frontend reuses them. Do not duplicate
  DTO shapes in apps. They state the **constraint only, never a message** — see
  below.
- **CASL helpers**: `defineAbilitiesFromPermissions` (DB-driven, the source of
  truth) and the legacy `defineAbilitiesFor` fallback.
- **Types**: `Role` (free-form role-name `string`), `PermissionDefinition`,
  `AuthProvider`, `JwtPayload`, `TokenPair`, `PaginationParams`,
  `PaginatedResponse<T>`.
- **Constants**: `AUTH`, `PAGINATION`, `ROLES`, `SYSTEM_ROLES`,
  `SYSTEM_ROLE_PERMISSIONS`, `QUEUE_NAMES`.

## Schemas carry no message strings

```ts
// Right
email: z.string().email(),
password: z.string().min(8),

// Wrong — untranslatable
email: z.string().email('Invalid email address'),
```

Zod ignores the error map it is handed whenever a check states its own message,
so a hardcoded string silently pins every consumer to English. The apps' forms
translate from the issue code instead (`createZodErrorMap` in
`@oppenheimer/frontend/validation`), and that only works if the schema stays quiet.

A `refine` whose meaning cannot be recovered from the issue code — an IP-or-CIDR
check, say — is the exception, and falls through untranslated by design.

Full context in [`.agents/rules/forms.md`](../../.agents/rules/forms.md).

## When modifying

- Changing a schema/type may ripple into `apps/api`, `@oppenheimer/frontend`, and
  `@oppenheimer/api-client`. Check consumers before altering the public surface.
- `apps/web` cannot import runtime values from the package root (CASL and the
  scope catalog would land in the browser bundle). A schema the web app needs
  wants a narrow `exports` subpath — `./schemas/auth` is the worked example.
- After schema changes that affect API DTOs, regenerate the client
  (`pnpm generate:api-client`).

## Commands

```bash
pnpm --filter @oppenheimer/shared build
pnpm --filter @oppenheimer/shared dev
```
