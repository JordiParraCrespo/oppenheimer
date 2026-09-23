# @oppenheimer/shared

Framework-agnostic contracts shared between the API, the frontend package, and
the generated API client. This is the single source of truth for DTO shapes,
domain types, authorization rules, and constants — define them here once instead
of duplicating them per app.

## What's inside

| Export path                          | Contents                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@oppenheimer/shared`                | Re-exports `schemas`, `types`, `constants`, `permissions` and `scopes` — **not** `agents` or `protocol` (see below)                             |
| `@oppenheimer/shared/schemas`        | Zod schemas — the source of truth for request/response DTOs — plus the shared primitives every schema is built from                             |
| `@oppenheimer/shared/schemas/*`      | One narrow subpath per schema file (`auth`, `admin`, `profile`, `organization`, `role`, `host`, `project`, `session`, `github`)                  |
| `@oppenheimer/shared/types`          | `Role`, `PaginationParams`, `PaginatedResponse<T>`, the deployment/client capability catalogs and the RFC 7807 problem-details helpers           |
| `@oppenheimer/shared/constants`      | `AUTH`, `PAGINATION`, `ROLES`, `SYSTEM_ROLES`, `SYSTEM_ROLE_PERMISSIONS`, `QUEUE_NAMES`                                                         |
| `@oppenheimer/shared/permissions`    | CASL helpers — `defineAbilitiesFromPermissions` (DB-driven, source of truth), the legacy `defineAbilitiesFor` fallback, and `ENDPOINT_POLICIES`  |
| `@oppenheimer/shared/scopes`         | The credential scope catalog: `SCOPE_RESOURCES`, `PERMISSION_GROUPS`, `SCOPES`, and the helpers that expand, sort, compare and grant them       |
| `@oppenheimer/shared/agents`         | The closed coding-agent catalog: `CODING_AGENT_IDS`, `CODING_AGENTS`, `isCodingAgentId`                                                         |
| `@oppenheimer/shared/protocol`       | The runner link's wire vocabulary as Zod: `protocolMessageSchema`, the per-message schemas, the hint sets, and `PROTOCOL_VERSION`               |

`agents` and `protocol` are reachable **only** through their subpaths. The root
barrel is not tree-shakeable in the CJS build, so everything it re-exports lands
whole in the browser bundle; keeping the agent catalog and the wire protocol out
of it is what stops `apps/web` paying for them.

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
- `ENDPOINT_POLICIES` declares what each guarded endpoint demands, keyed by the
  path the API mounts it at. A client that hides a destination behind
  permissions reads its rules from here rather than restating them.
- A client's own route paths are **not** shared — they stay in the app that
  mounts them, and a gated nav row names the endpoint it reads. That is what
  lets `apps/api` check its controllers against the catalog without depending
  on a frontend package.

## Scripts

```bash
pnpm build   # tsc -> dist, then emit protocol-schema/protocol.schema.json
pnpm dev     # tsc --watch
pnpm lint    # biome check src/
```

`protocol-schema/protocol.schema.json` is **generated and committed**, and it is
emitted by `build` itself rather than by a script somebody has to remember. It is
what the Go structs for the runner are generated from, so a wire change shows up
as a reviewable diff in it, and the spec in `src/protocol/__tests__/` fails if the
committed file has drifted from the schemas.

## Consumed by

`apps/api`, `apps/web`, `packages/auth`, `packages/backend/core`,
`packages/backend/authz`, and the `packages/frontend` packages (`core`,
`consumer`, `web`).
