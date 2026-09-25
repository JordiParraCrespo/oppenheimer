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
├── feature-flags/ # the flag catalog, the evaluator, targeting schemas
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
- **The feature-flag catalog** (`feature-flags/catalog.ts`): every flag the
  code may read, and the pure evaluator the API runs over it. Like `agents/`
  and `protocol/`, it is reached through its own subpaths and not the root
  barrel: the API imports `@oppenheimer/shared/feature-flags`, the web tier
  `@oppenheimer/shared/feature-flags/catalog` (no Zod); see
  `.agents/rules/feature-flags.md`.
- **Types**: `Role` (free-form role-name `string`), `PermissionDefinition`,
  `AuthProvider`, `JwtPayload`, `TokenPair`, `PaginationParams`,
  `PaginatedResponse<T>`.
- **Constants**: `AUTH`, `PAGINATION`, `ROLES`, `SYSTEM_ROLES`,
  `SYSTEM_ROLE_PERMISSIONS`, `QUEUE_NAMES`.
- **The coding-agent catalog** (`agents/catalog.ts`): a closed union plus one
  frozen config record per agent. It is deliberately **not a table** — every
  entry carries behaviour the runner needs code for anyway, so a row would be a
  second source of truth. Keep it data; the type guard is the only function.
- **`hostFactsSchema` is the runner's `Facts` struct, verbatim.** It mirrors
  `apps/runner/internal/host/domain/facts.go` key for key and json tag for json
  tag, because the runner marshals that struct whole into `POST /hosts/register`
  and into the link's `hello` and `heartbeat` — all three parse one schema. The
  register body is the **runner's** to define: if the struct changes, this
  schema follows it, never the other way round. Agents are read from `tools`
  (entries named `claude` / `codex`); there is no agents key. Keep the classic
  and `zod/v4` copies identical — `src/__tests__/cross-version-primitives.spec.ts`
  parses a literal sample of the Go output against both.
- **The wire protocol** (`protocol/`): the runner link's control messages as
  Zod, with `protocolMessageSchema` the discriminated union over `type`. It is
  the **only** description of the wire: `pnpm build` emits
  `protocol-schema/protocol.schema.json` from it and the Go structs are
  generated from that, so never hand-write a twin in either language. Changing
  a message means rebuilding and committing the artifact —
  `src/protocol/__tests__/` fails if you forget. The emitter
  (`src/protocol/json-schema.ts`) is build-only and deliberately not exported
  from `src/protocol/index.ts`.

  **The protocol is temporarily on a second Zod entry point.** Only `zod/v4` can
  emit JSON Schema (`z.toJSONSchema`), so `src/protocol/` imports it while every
  DTO schema imports classic `zod`. This is a known wart, not a design: it means
  `hostFactsSchema` exists twice, and `src/__tests__/cross-version-primitives.spec.ts`
  is what holds the two copies in step. The fix is one Zod line for the package
  with a build-only converter; it needs a new devDependency, which could not be
  installed here. Do not add more duplicated schemas in the meantime — shared
  bounds and tuples live in `src/schemas/primitives.ts` and the protocol builds
  from those.

## What does not live here

A client's own vocabulary, even when it is derived from a contract that does.
Route paths are the clearest case: a URL belongs to the app that mounts it, and
two clients may reach the same endpoint under different names. A nav row that gates on a permission names its endpoint where
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
