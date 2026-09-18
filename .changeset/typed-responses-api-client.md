---
"@oppenheimer/api-client": minor
---

Regenerated against the tightened OpenAPI document: scope arrays now carry the
`SCOPES` union instead of `string[]`, the permission catalog carries
`PermissionGroupDto` and friends instead of `Record<string, any>[]`, and
`GET /v1/users` carries `PaginatedUsersResponseDto` instead of `any`.
