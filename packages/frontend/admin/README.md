# @oppenheimer/frontend-admin

The control plane's domain, on top of the kernel. It holds what
`apps/admin-web` and `apps/admin-mobile` need and the consumer apps do not:
platform user lifecycle (create, update, ban, delete, sessions, passwords,
platform role) and the database-backed roles and permissions. Each module is
an entity, an error catalog, a repository over `@oppenheimer/api-client`, a service
and an InversifyJS `ContainerModule`; `src/react/` turns those services into
TanStack Query hooks. It is platform-free, and it never imports
`@oppenheimer/frontend-consumer`.

An app becomes the control plane by loading `adminModules` into
`OppenheimerApp.create({ modules })`.

## What it exports

`@oppenheimer/frontend-admin` (`src/index.ts`):

- **di** — `AdminApp`, `adminModules`, `TOKENS` (the kernel's spread, plus
  `AdminUsersRepository`, `AdminUsersService`, `RolesRepository`,
  `RolesService`).
- **modules/admin-users** — `AdminUserEntity`, `AdminSessionEntity`,
  `AdminUsersService`, `AdminUsersRepository`, `AdminUsersModule`,
  `AdminUsersErrors`, `AdminUsersListParams`.
- **modules/roles** — `RoleEntity` and the rest of `role.entity.ts`,
  `RolesService`, `RolesRepository`, `RolesModule`, `RolesErrors`.

`@oppenheimer/frontend-admin/react` (`src/react/index.ts`):

- `useAdminApp` — the product's services off the kernel container.
- Users: `useAdminUsers`, `useAdminUser`, `useCreateAdminUser`,
  `useUpdateAdminUser`, `useDeleteAdminUser`, `useBanAdminUser`,
  `useUnbanAdminUser`, `useSetAdminUserPassword`, `useSetPlatformRole`,
  `useAdminUserSessions`, `useRevokeAdminUserSessions`,
  `useAssignAdminUserRoles`, `adminUsersKeys`.
- Roles: `useRoles`, `useCreateRole`, `useUpdateRole`, `useDeleteRole`,
  `useUserRoles`, `useUsersRoles`, `useAssignUserRoles`,
  `useAuthorizationCatalog`, `rolesKeys`.

## How to use it

`apps/admin-web/src/features/admin-users/screens/users.tsx` lists users with
their roles:

```tsx
import type { AdminUserEntity } from '@oppenheimer/frontend-admin';
import { useAdminUsers, useRoles, useUsersRoles } from '@oppenheimer/frontend-admin/react';

const users = useAdminUsers({ search, limit: PAGE_SIZE, offset, sortBy, sortDirection });
const rows = users.data?.data ?? [];
const userRolesQueries = useUsersRoles(rows.map((user) => user.id));
```

`useAssignUserRoles` (`src/react/roles.queries.ts`) also invalidates
`MEMBER_LISTS_KEY` from `@oppenheimer/frontend-core/react`: a consumer member list
filtered by role is stale the moment a role changes hands, and that kernel
key is how the two products say so without importing each other.

## How to run it

```bash
pnpm --filter @oppenheimer/frontend-admin lint
pnpm --filter @oppenheimer/frontend-admin test
pnpm --filter @oppenheimer/frontend-admin arch
pnpm --filter @oppenheimer/frontend-admin build   # tsc -> dist, what the apps consume
```

## Depends on / used by

Depends on `@oppenheimer/frontend-core`, `@oppenheimer/api-client`, `@oppenheimer/shared` and
`inversify`. Used by `apps/admin-web` and `apps/admin-mobile`. The consumer
apps never load it — `one-product-per-app` fails if they do.
