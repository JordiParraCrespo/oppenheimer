# @oppenheimer/shared

Framework-agnostic contracts shared between the API, the frontend package, and
the generated API client. This is the single source of truth for DTO shapes,
domain types, authorization rules, and constants — define them here once instead
of duplicating them per app.

## What's inside

| Export path                 | Contents                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@oppenheimer/shared`             | Re-exports everything below                                                                                                             |
| `@oppenheimer/shared/schemas`     | Zod schemas — the source of truth for request/response DTOs                                                                             |
| `@oppenheimer/shared/types`       | TypeScript types: `Role`, `PermissionDefinition`, `AuthProvider`, `JwtPayload`, `TokenPair`, `PaginationParams`, `PaginatedResponse<T>` |
| `@oppenheimer/shared/permissions` | CASL helpers — `defineAbilitiesFromPermissions` (DB-driven, source of truth) and the legacy `defineAbilitiesFor` fallback               |
| `@oppenheimer/shared/constants`   | `AUTH`, `PAGINATION`, `ROLES`, `SYSTEM_ROLES`, `SYSTEM_ROLE_PERMISSIONS`, `QUEUE_NAMES`                                                 |

## Usage

```ts
import { loginSchema } from "@oppenheimer/shared/schemas";
import type { PaginatedResponse } from "@oppenheimer/shared/types";
import { defineAbilitiesFromPermissions } from "@oppenheimer/shared/permissions";
import { PAGINATION } from "@oppenheimer/shared/constants";
```

## Conventions

- Zod schemas are the single source of truth for DTOs; the API derives its
  validation from them and the typed API client is generated to match.
- Authorization is database-backed dynamic RBAC. `defineAbilitiesFromPermissions`
  builds a CASL ability from a role's stored permissions and is shared by both
  backend and frontend. See `.agents/rules/rbac-roles.md`.

## Scripts

```bash
pnpm build   # tsc -> dist
pnpm dev     # tsc --watch
pnpm lint    # biome check src/
```

## Consumed by

`apps/api`, `packages/frontend`, `packages/api-client`.
