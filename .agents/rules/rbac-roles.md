---
paths:
  - "apps/api/**/*"
  - "packages/shared/**/*"
---

# Roles & Authorization (RBAC) Rules

> **The kernel.** Row-level authorization lives in `@oppenheimer/backend-authz`
> (`packages/backend/authz`) — the resource registry, `AccessScope`, the SQL
> predicate generator, the scoped repository base and the containment checks.
> Read its README before adding a resource; the two-step recipe there
> (`defineResource` + `ScopedRepositoryBase`) is the whole interface, and
> `apps/api/src/leads/` is the worked example.
>
> Three rules that are easy to break and hard to notice:
>
> - **Every route declares its intent.** `@CheckPolicies` for a capability, or
>   `@NoPolicy('reason')` for a deliberate exemption. `PoliciesGuard` rejects a
>   route that declares neither, and `route-policy-coverage.spec.ts` fails the
>   build.
> - **Never cache structural scope.** Team membership is written by Better Auth
>   outside any application transaction, so nothing invalidates it. Role *rules*
>   are cached on `organization.roleVersion`, bumped in the same transaction as
>   the write.
> - **Nobody grants what they do not hold.** `RoleGrantPolicy` enforces it on
>   role writes; `canGrantScope` on access grants.

Authorization is **database-backed and admin-managed** (dynamic RBAC). Roles and
their permissions live in the `role` table (not in code); a user's effective
permissions are the **union of every role assigned to them** via the `user_role`
join. CASL turns those permissions into an ability that guards check.

Do **not** reintroduce a hardcoded role→permission switch. The legacy
`defineAbilitiesFor(role)` helper remains only as a fallback/ frontend
convenience — application authorization goes through the database.

## Where things live

| Concern                             | Location                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| Permission/ability building (CASL)  | `packages/shared/src/permissions` (`defineAbilitiesFromPermissions`)                        |
| Role Zod schemas                    | `packages/shared/src/schemas/role.schema.ts`                                                |
| Roles module (aggregate, use cases) | `apps/api/src/roles/`                                                                       |
| Effective-ability resolution        | `apps/api/src/roles/services/ability.factory.ts`                                            |
| Route guard + policy decorator      | `apps/api/src/auth/guards/policies.guard.ts`, `auth/decorators/check-policies.decorator.ts` |

## Data model

- **`RoleEntity`** (aggregate) — `name` (unique, immutable), `description`,
  `isSystem`, and `permissions: Permission[]` (a value object), persisted as a
  `jsonb` column on the `role` table.
- **`user_role`** — many-to-many join (`userId`, `roleId`); a user may hold
  several roles.
- **System roles** (`admin`, `user`) are seeded by the migration and **cannot be
  deleted or renamed** (`isSystem = true`). Their permissions can still be edited.
- `Role` (in `@oppenheimer/shared`) is a plain `string` — role names are dynamic.

## Permission shape

A permission is a CASL rule (`PermissionDefinition` in `@oppenheimer/shared`):

```ts
interface PermissionDefinition {
  action: string; // free-form, e.g. 'read' | 'create' | 'manage'
  subject: string; // free-form, e.g. 'User' | 'Article' | 'all'
  conditions?: Record<string, unknown>; // resource scoping (see below)
  fields?: string[]; // restrict to specific attributes
  inverted?: boolean; // turns the rule into a `cannot`
  reason?: string;
}
```

`action`/`subject` are **free-form strings** so admins can author permissions for
any resource. The well-known values live in `KNOWN_ACTIONS` / `KNOWN_SUBJECTS`
(convenience only — they do not constrain what can be stored). `manage` is CASL's
wildcard action; `all` is its wildcard subject (admins get `manage all`).

## Protecting an endpoint

Add the guards and a policy. The guard resolves the caller's ability from their
roles and checks the rule:

```ts
@UseGuards(AuthGuard, PoliciesGuard)
@Controller("articles")
export class PublishArticleHttpController {
  @Post(":id/publish")
  @Version("1")
  @CheckPolicies({ action: "update", subject: "Article" })
  async publish(/* ... */) {}
}
```

- `AuthGuard` (Better Auth) authenticates and populates `request.user`.
- `PoliciesGuard` builds the ability via `AbilityFactory.createForUser(user)`
  (union of the user's roles' permissions, falling back to the legacy
  `user.role`), checks every `@CheckPolicies` rule, and attaches the built
  ability to `request.ability`.
- No `@CheckPolicies` ⇒ any authenticated user passes (e.g. `GET /users/me`).

### An endpoint a client gates a destination on declares its rules once

Some endpoints are the thing a client hides a link behind — members, roles, API
tokens, admin, billing. Their `@CheckPolicies` is declared once, in
`ENDPOINT_POLICIES` (`packages/shared/src/permissions/endpoint-policies.ts`),
and asserted by `apps/api/src/auth/__tests__/endpoint-policies.spec.ts`: it
checks the handler exists, that it is mounted at the path the catalog names,
and that its `@CheckPolicies` is exactly the rule list there. Change the policy
on one of those handlers and the test fails until the catalog says the same
thing — which is the point: a policy added to a controller would otherwise
leave a client offering a link that could only answer 403, and nothing in the
build would notice. `GET /users/me/permissions` serves the caller's effective
rules so the client can apply the same catalog.

The catalog is keyed by **endpoint**, and holds no client's route paths: a URL
belongs to the app that mounts it, and the web, control-plane and mobile apps
reach these handlers under different names. A nav row that gates on one of
these reads `ENDPOINT_POLICIES[<endpoint>]` where the row is declared.

If an endpoint's data moves to a different handler, move its entry in
`HANDLERS` there too. The test is only as honest as the handler it is pointed
at.

### Resource scoping (own-resource checks)

The guard only checks **action + subject** (type level) — it does not see the
concrete entity. For "only your own X" rules, store a condition with a
`${...}` placeholder and enforce it in the handler against the loaded entity:

```ts
// permission stored on a role:
{ action: 'update', subject: 'Article', conditions: { authorId: '${user.id}' } }

// in the handler, using the ability the guard attached:
import { subject } from '@casl/ability';
if (!request.ability.can('update', subject('Article', article))) {
  throw new ForbiddenException();
}
```

`${user.id}` (any `user.*` path) is interpolated from the authenticated principal
when the ability is built.

## Adding a new protected resource

1. Pick a `subject` string (e.g. `'Invoice'`) and annotate the endpoints with
   `@CheckPolicies({ action, subject })`.
2. Optionally add it to `KNOWN_SUBJECTS` in `@oppenheimer/shared` for discoverability.
3. Grant access by adding permissions to a role through the API — **no code
   change is needed to authorize a role**. Admins (`manage all`) pass by default.

## Managing roles & assignments (admin-only API)

| Method & path                   | Purpose                                    |
| ------------------------------- | ------------------------------------------ |
| `POST /v1/roles`                | Create a custom role                       |
| `GET /v1/roles`                 | List roles (paginated, `?search=`)         |
| `GET /v1/roles/:id`             | Get a role                                 |
| `PATCH /v1/roles/:id`           | Update description and/or permissions      |
| `PUT /v1/roles/:id/permissions` | Replace a role's permission set (granular) |
| `DELETE /v1/roles/:id`          | Delete a custom role (system roles 403)    |
| `GET /v1/users/:userId/roles`   | List a user's assigned roles               |
| `PUT /v1/users/:userId/roles`   | Replace a user's assigned roles            |

Role endpoints are gated by `Role` policies (`create`/`read`/`update`/`delete`);
assignment endpoints by `manage User`. New sign-ups are assigned the default
`user` role; the migration seeds the system roles and backfills existing users
from the legacy `user.role` column.

## Wiring notes

- `RolesModule` is `@Global` so the `AbilityFactory` (needed by `PoliciesGuard`
  in every feature module) and the repository ports are available app-wide
  without circular module imports.
- The roles module follows the standard DDD-Hexagon layout
  (`nestjs-architecture.md`); permission editing goes through domain methods
  (`RoleEntity.replacePermissions`), never by mutating ORM records directly.
- After changing role/assignment endpoints, run `pnpm generate:api-client` and
  add a changeset.

## Organizations, workspaces & super-admin (Better Auth plugins)

Multi-tenancy and super-admin are provided by Better Auth's **`admin`** and
**`organization`** plugins, configured in `apps/api/src/auth/auth.ts`. Their
endpoints live under `/api/auth/*` (not NestJS controllers), so the frontend
calls them through the `adminClient()` / `organizationClient()` client plugins,
**not** the generated api-client.

- **Super-admin** — the `admin` plugin (`adminRoles: ['superadmin','admin']`)
  gates `/api/auth/admin/*` (list/ban/impersonate/set-role) by the user's `role`
  column. A `superadmin` system role is seeded; `BETTER_AUTH_ADMIN_USER_IDS`
  bootstraps break-glass super admins by id. This is **separate** from CASL: CASL
  still governs the app's own REST routes.
- **Two role stores, kept in sync** — the admin plugin's `set-role` writes the
  single `user.role` column; the app's dynamic RBAC lives in the `user_role`
  join. `AbilityFactory` builds the CASL ability from the **union** of both (the
  join roles _and_ the `user.role` column's role), so an admin-plugin promotion
  flows into CASL and vice-versa. Fine-grained per-role permissions still come
  from `user_role` (assign via `PUT /v1/users/:userId/roles`); `user.role` is a
  single system-role name for admin-plugin gating.
- **Organizations / members / invitations** — the `organization` plugin owns the
  `organization`, `member`, `invitation` tables. **Sign-up provisions the
  personal workspace**: one organization with the account as its single
  `owner` member, so the session's `activeOrganizationId` is set from the
  first sign-in (`product/versions/mvp/08-auth.md`). It is the app's own rule
  rather than Better Auth's, so it is a real vertical slice —
  `organizations/commands/provision-personal-workspace/`, dispatched from the
  Better Auth sign-up hook through `auth/auth-command-bus.ts`. It is
  best-effort and idempotent: an account it did not land for still exists and
  is sent to `/onboarding`, the console's one organization-creating screen,
  which makes the caller the owner of their own workspace and nothing else
  (no roster, no invitation, no second workspace); the seed re-runs the same
  handler. The check is on membership, not ownership — see
  `product/versions/mvp/08-auth.md`, which records what that will mean once
  invitations exist. The default `user` role can *read* the organizations it belongs
  to and *create* one. Every path that creates a membership writes the
  org-scoped application role — the tenant `owner` system role for a Better
  Auth owner/admin, `user` for a member in the same breath —
  `ProvisionPersonalWorkspaceService` for the workspace sign-up gives,
  `InvitationsService.accept` for a workspace someone joins, and
  `OrganizationsService.create` for one the caller makes (which also
  provisions the "General" workspace) — so "you are a member" and "you may work
  here" are never set separately. `owner` grants organization resources only
  (Organization/Member/Invitation/Workspace/Role, conditioned on
  `${activeOrganizationId}`) and never `manage all` or `User`: assigned
  org-scoped, a `manage all` role is unioned into the ability whenever that
  organization is active, and every non-tenant route that checks only
  action + subject (`DELETE /users/:id`, the admin façade) would open to
  whoever created a workspace. `RoleGrantPolicy.assertCanModify` is the
  row-level half for roles — a global role never matches the owner's
  conditioned `manage Role`, so tenants cannot edit the platform's roles. That
  pairing is the point: provisioning a membership *without* the role is what
  once made a self-service sign-up the owner of an organization it had no
  permission to read, which is why the personal workspace writes the
  organization, the membership and the grant in one transaction. Invitation
  emails go through the BullMQ email queue (`EmailService.sendInvitation`).
- **First-class REST façade** — `apps/api/src/organizations/` and
  `apps/api/src/admin/` expose the plugin operations as typed, Swagger-documented,
  CASL-guarded endpoints (`/v1/organizations`, `/v1/organizations/:id/members`,
  `/v1/organizations/:id/invitations` + `/v1/invitations`, `/v1/workspaces`,
  `/v1/admin/users`) so they land in the generated `@oppenheimer/api-client`. These are
  **delegating façades**: the controllers/services call `auth.api.*` (via
  `auth/better-auth.util.ts` — `betterAuthHeaders` + `invokeBetterAuth`) rather
  than writing the tables, so Better Auth stays the single source of truth. They
  are infrastructure modules (controller → injectable service → `auth.api`), not
  CQRS/domain slices, since there is no app-owned aggregate. Impersonation
  forwards Better Auth's `Set-Cookie` to the client.
- **Workspaces = teams** — modelled on the org plugin's teams feature
  (`team` / `teamMember`).
- **Org-scoped CASL** — `PoliciesGuard` reads `session.activeOrganizationId` and
  passes it to `AbilityFactory.createForUser(user, scope)`. Scope tenant
  resources with a condition placeholder:
  `{ action: 'read', subject: 'Article', conditions: { organizationId: '${activeOrganizationId}' } }`,
  then enforce per-row in the handler via `request.ability.can('read', subject('Article', row))`.
- **Lockout protection** — a system role that grants `manage all` cannot have
  that rule removed (`RoleErrors.ADMIN_LOCKOUT`, enforced in the update-role
  command handlers via `RoleEntity.grantsFullAccess`).
