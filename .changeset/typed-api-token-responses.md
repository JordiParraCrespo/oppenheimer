---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend": minor
---

Describe scope and permission-catalog responses properly in OpenAPI, so the
generated client carries their real types.

Several response DTOs described themselves loosely enough that the generated
client lost the type and every consumer had to cast it back:

- Scope arrays (`ApiTokenResponseDto.scopes`, `PermissionCatalogResponseDto.grantable`,
  `CurrentCredentialResponseDto.grantedScopes` / `effectiveScopes`) were declared
  `type: [String]` and generated as `string[]`. They now declare `enum: SCOPES`,
  so the client sees the same 20-member union the request DTO already used.
- `PermissionCatalogResponseDto.groups` was an untyped object array and generated
  as `Record<string, any>[]`. The catalog now has real DTOs — `PermissionGroupDto`,
  `ScopeLevelsDto`, `ScopeLevelDto`, `ScopePolicyDto` — mirroring `PermissionGroup`
  from `@oppenheimer/shared`, so drift between the two becomes a compile error.
- `GET /v1/users` declared no response schema at all and generated as `any`, taking
  the whole paginated list with it. It now returns `PaginatedUsersResponseDto`
  (with `PaginationMetaDto`).

The wire format is unchanged — only its description. `@oppenheimer/frontend`'s
repositories drop the casts this forced (including a `dto as never` that was
disabling type checking on the create-token request body) and read the generated
DTOs directly. `UsersRepository.findAll` / `UsersService.findAll` widen their
`role` filter from `'admin' | 'user'` to `Role`, matching the database-backed
roles the API actually accepts.

The root `generate:openapi` script ran `nest build` from the repo root, where
there is no Nest workspace, so `pnpm generate:api-client` always failed; it now
delegates to `@oppenheimer/api`.
