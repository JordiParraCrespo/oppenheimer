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
├── permissions/   # CASL ability helpers + the endpoint policy catalog
├── scopes/        # the credential scope catalog
├── agents/        # the closed coding-agent catalog
├── protocol/      # the runner link's wire vocabulary, as Zod
└── index.ts
```

## What lives here

- **Zod schemas** are the single source of truth for DTOs. Define once here;
  the API validates against them and the frontend reuses them. Do not duplicate
  DTO shapes in apps. They state the **constraint only, never a message** — see
  below.
- **CASL helpers**: `defineAbilitiesFromPermissions` (DB-driven, the source of
  truth) and the legacy `defineAbilitiesFor` fallback.
- **`ENDPOINT_POLICIES`** (`permissions/endpoint-policies.ts`): what each
  guarded endpoint demands, keyed by the path Nest mounts it at. One
  declaration of a rule the API enforces and a client gates a destination on;
  `apps/api/src/auth/__tests__/endpoint-policies.spec.ts` pins the controllers
  to it.
- **Types**: `Role` (free-form role-name `string`), `PermissionDefinition`,
  `AuthProvider`, `JwtPayload`, `TokenPair`, `PaginationParams`,
  `PaginatedResponse<T>`.
- **Constants**: `AUTH`, `PAGINATION`, `ROLES`, `SYSTEM_ROLES`,
  `SYSTEM_ROLE_PERMISSIONS`, `QUEUE_NAMES`.
- **The coding-agent catalog** (`agents/catalog.ts`): a closed union plus one
  frozen config record per agent. It is deliberately **not a table** — every
  entry carries behaviour the runner needs code for anyway, so a row would be a
  second source of truth. Keep it data; the type guard is the only function.
- **The wire protocol** (`protocol/`): the runner link's control messages as
  Zod, with `protocolMessageSchema` the discriminated union over `type`. It is
  the **only** description of the wire: `pnpm build:protocol` emits
  `protocol-schema/protocol.schema.json` from it and the Go structs are
  generated from that, so never hand-write a twin in either language. Changing
  a message means re-running `build:protocol` and committing the artifact —
  `src/protocol/__tests__/` fails if you forget.

  The protocol imports `zod/v4` while every other schema here imports `zod`
  (v3 classic). That is on purpose and is the only place it happens: `zod`
  3.25 ships both, only the v4 entry point can emit JSON Schema
  (`z.toJSONSchema`), and the two never meet — the API's validation pipes see
  the v3 DTO schemas, the relay gateway parses protocol messages directly.

## What does not live here

A client's own vocabulary, even when it is derived from a contract that does.
Route paths are the clearest case: a URL belongs to the app that mounts it, and
`apps/web`, `apps/admin-web` and `apps/mobile` reach the same endpoints under
different names. A nav row that gates on a permission names its endpoint where
the row is declared and reads `ENDPOINT_POLICIES[<endpoint>]`; there is no
shared route list, and the API takes no dependency on a frontend package to
check itself against the catalog.

The test is whether both tiers would need the thing if the other were replaced
wholesale. A DTO shape, a role name, an endpoint's rules: yes. A screen, a
sidebar row, a URL: no.

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
