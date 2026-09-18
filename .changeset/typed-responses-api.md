---
"@oppenheimer/api": minor
---

Describe scope and permission-catalog responses properly in OpenAPI, so the
generated client carries their real types. The wire format is unchanged — only
its description.

- Scope arrays (`ApiTokenResponseDto.scopes`,
  `PermissionCatalogResponseDto.grantable`,
  `CurrentCredentialResponseDto.grantedScopes` / `effectiveScopes`) were
  declared `type: [String]`. They now declare `enum: SCOPES`, so the client
  sees the same 20-member union the request DTO already used.
- `PermissionCatalogResponseDto.groups` was an untyped object array. The
  catalog now has real DTOs — `PermissionGroupDto`, `ScopeLevelsDto`,
  `ScopeLevelDto`, `ScopePolicyDto` — mirroring `PermissionGroup` from
  `@oppenheimer/shared`, so drift between the two becomes a compile error.
- `GET /v1/users` declared no response schema at all. It now returns
  `PaginatedUsersResponseDto` (with `PaginationMetaDto`).

The root `generate:openapi` script ran `nest build` from the repo root, where
there is no Nest workspace, so `pnpm generate:api-client` always failed; it now
delegates to `@oppenheimer/api`.
