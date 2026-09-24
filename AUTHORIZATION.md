# Authorization Kernel (starter design, kept as history)

> **Read this first.** This document is the design of the authorization
> kernel the Flama starter shipped with, and it describes the starter's
> imagined products (a CRM with leads, a WMS, a support desk). Oppenheimer
> is none of those: the MVP is a single-user terminal orchestrator with a
> personal workspace per account, and its auth model fits on one page:
> [`product/versions/mvp/08-auth.md`](product/versions/mvp/08-auth.md).
> The kernel's mechanics (resource registry, fail-closed `PoliciesGuard`,
> scopes, grants) are still what runs in `apps/api`, so this stays as the
> reference for *how* they work. Nothing below is a product decision for
> Oppenheimer; where the two disagree, the product notes win.

> **Status:** the kernel is built. Phases 0–2 and the grant-safety half of
> Phase 3 are implemented, tested and on `main`'s branch; the audit log and the
> web/CLI/MCP surfaces are not. Part 5 marks what is done and what is left.
>
> The build recipe lives in
> [`packages/backend/authz/README.md`](packages/backend/authz/README.md) —
> read that to add a resource. This document is the design and the plan behind
> it.

## What shipped

| Piece | Where |
| --- | --- |
| Resource registry (`defineResource`, `ResourceRegistry`) | `packages/backend/authz/src/registry/` |
| `AccessScope`, `ScopeResolverPort`, the default resolver | `packages/backend/authz/src/scope/`, `apps/api/src/authz/application/scope.resolver.ts` |
| SQL predicate generation + `ScopedRepositoryBase` | `packages/backend/authz/src/scope/` |
| `${scope.*}` placeholders, deny precedence | `packages/shared/src/permissions/index.ts` |
| Fail-closed `PoliciesGuard`, `@NoPolicy`, coverage test | `apps/api/src/auth/guards/`, `apps/api/src/__tests__/` |
| Org-scoped roles + `X-Active-Organization` validation | `apps/api/src/migrations/1781400000000-AddOrgScopedRoles.ts`, `apps/api/src/authz/application/` |
| Generic `access_grant` table | `apps/api/src/migrations/1781500000000-AddAccessGrants.ts` |
| `canGrant` / `canGrantScope` containment | `packages/backend/authz/src/grants/`, `apps/api/src/roles/application/role-grant.policy.ts` |
| `GET /v1/authz/catalog` | `apps/api/src/authz/queries/find-catalog/` |

---

## Part 1 — What we are building, and why

The starter this codebase began from is a boilerplate. The next product built
on it might be a CRM with leads, a WMS with warehouses, a support desk with
queues, or a billing console with invoices. Authorization is the part of a boilerplate that is most expensive to
retrofit and most damaging to get wrong, so it has to be **generic on the way
in**.

The goal is an **authorization kernel**: a module declares one metadata object
about its resource and gets, without writing authorization code —

- tenant isolation (its rows cannot leak across organizations),
- team scoping (a team sees only its own rows),
- row-level SQL filtering that cannot be forgotten,
- an entry in the role-builder UI,
- an API-token / MCP scope,
- and a policy test harness.

### The motivating scenario

A `leads` module. Leads belong to an organization and to a team within it. The
requirements, in increasing difficulty:

1. Org A never sees org B's leads. _(tenant isolation)_
2. The Madrid team sees only Madrid's leads; the Barcelona team sees only
   Barcelona's. _(team scoping)_
3. A named auditor is granted read access to three specific leads outside their
   team, expiring in 30 days. _(explicit, time-boxed grants)_
4. A junior rep can read a lead but not its `value` field. _(field-level)_
5. A rep can edit only leads they own. _(own-resource)_
6. None of the above requires a code change to grant — an admin composes it in
   the UI. _(dynamic RBAC)_

Every one of these must hold on **every** access path: REST, the generated API
client, an API token, an MCP tool, and the CLI. "The list endpoint filters
correctly but the detail endpoint doesn't" is the failure mode this design
exists to make structurally impossible.

`leads` is the reference module we build in Phase 4 to prove the kernel. It is
not a product feature; it is the executable specification.

---

## Part 2 — Current state audit

### What already exists and is good

| Piece                                                                                             | Location                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| CASL rule shape (`action` / `subject` / `conditions` / `fields` / `inverted`)                     | `packages/shared/src/permissions/index.ts`                                    |
| `${...}` placeholder interpolation (`user.*`, `activeOrganizationId`, `activeTeamId`)             | same file, `interpolateConditions`                                            |
| DB-backed roles + `user_role` join, full admin CRUD, CQRS slices                                  | `apps/api/src/roles/`                                                         |
| `RoleEntity` aggregate with `Permission` value objects, `grantsFullAccess` lockout guard          | `apps/api/src/roles/domain/`                                                  |
| `PoliciesGuard` + `@CheckPolicies`, ability attached to `request.ability`                         | `apps/api/src/auth/guards/policies.guard.ts`                                  |
| Credential scopes: catalog, `@RequireScopes`, `ScopesGuard` (**fails closed**), `grantableScopes` | `packages/shared/src/scopes/`, `apps/api/src/auth/guards/scopes.guard.ts`     |
| Organization-restricted credentials (`ResourceScope`, `@OrganizationScoped`)                      | `packages/shared/src/scopes/resource-scope.ts`                                |
| Platform tier: Better Auth `admin` plugin, `superadmin` role, impersonation                       | `apps/api/src/auth/infrastructure/better-auth.config.ts`, `apps/api/src/admin/`                            |
| Orgs, members, teams (= workspaces), `session.activeOrganizationId` / `activeTeamId`              | `apps/api/src/organizations/`, `apps/api/src/auth/database/session.orm-entity.ts` |
| Transactional outbox for domain events                                                            | `packages/backend/ddd/src/outbox/`                                            |
| Permission picker UI + `GET /v1/tokens/permissions` serving `{ groups, grantable }`               | `apps/web/src/components/permission-picker.tsx`                               |

The CASL engine needs no replacement. What is missing is everything **around**
it: scoping, a registry, enforcement below the route, and governance.

### Gaps, precisely

| #   | Gap                                                                                                                                                                                                                                                             | Evidence                                                       | Severity                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------ |
| G1  | **Roles are global.** `role.name` is `UNIQUE` across the whole table; `user_role` has no `organizationId`. Two tenants cannot both have a `manager` role, and a role granted in org A applies in org B.                                                         | `1780900000000-AddRolesRbac.ts`, `user-role.orm-entity.ts`     | **Blocking for multi-tenancy** |
| G2  | **`PoliciesGuard` fails open.** `if (!rules \|\| rules.length === 0) return true` — a route with no `@CheckPolicies` is reachable by any authenticated session. `ScopesGuard` fails closed; the two layers disagree and the permissive one is the policy layer. | `policies.guard.ts:31`                                         | **High**                       |
| G3  | **No row-level enforcement.** `conditions` are interpolated onto the ability but nothing applies them to a query. Every handler must remember `ability.can('read', subject('Lead', row))` by hand.                                                              | no `applyAccessScope` equivalent exists                        | **High**                       |
| G4  | **No scope dimension below the organization.** `activeTeamId` is interpolatable but there is no resolution of _which_ teams a user belongs to, and no way to express "these specific rows".                                                                     | —                                                              | **High**                       |
| G5  | **`KNOWN_SUBJECTS` is a hardcoded 11-entry literal.** Adding a module means editing `@oppenheimer/shared`.                                                                                                                                                            | `permissions/index.ts:21`                                      | Medium                         |
| G6  | **Two hand-maintained catalogs.** `SCOPE_RESOURCES` (credential scopes) and `KNOWN_SUBJECTS` (CASL subjects) must be kept consistent by hand or a new endpoint is invisible to API tokens.                                                                      | `scopes/catalog.ts`, `permissions/index.ts`                    | Medium                         |
| G7  | **No grant safety on roles.** `grantableScopes` stops a token exceeding its creator, but nothing stops a user with `update Role` writing `manage all` onto a role and assigning it to themselves.                                                               | `create-role.service.ts`, `update-role-permissions.service.ts` | **High**                       |
| G8  | **Ability rebuilt per request, uncached.** Two queries minimum; four call sites of `AbilityFactory` in the request path.                                                                                                                                        | `ability.factory.ts`, 4 callers                                | Medium                         |
| G9  | **Deny precedence unspecified.** CASL is last-rule-wins; unioning roles means an `inverted` rule in one role can be silently overridden by another depending on iteration order.                                                                                | `defineAbilitiesFromPermissions`                               | Medium                         |

---

## Part 3 — The model

Four questions on every request. All must pass; **Q0 short-circuits above the
rest**.

| #      | Question                       | Mechanism                                            | Where enforced                                                       |
| ------ | ------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------- |
| **Q0** | Is this a platform operator?   | Better Auth `admin` plugin role + `@PlatformAdmin()` | Guard, short-circuit, always audited                                 |
| **Q1** | Which tenant's data?           | `organizationId` on every row + active-org context   | Ability conditions **and** SQL predicate                             |
| **Q2** | Which slice within the tenant? | `AccessScope`: team membership ∪ explicit grants     | Ability conditions **and** SQL predicate                             |
| **Q3** | What may you do to it?         | Dynamic CASL RBAC, org-scoped roles                  | `PoliciesGuard` (type level) + `@AuthorizeResource` (instance level) |

Two role concepts stay in distinct lanes and must not be conflated:

|                     | `member.role` (Better Auth org plugin)                                                         | Dynamic RBAC (`role` / `user_role` + CASL) |
| ------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Values              | fixed: `owner` / `admin` / `member`                                                            | unlimited, admin-authored                  |
| Granularity         | coarse tier                                                                                    | action × subject × field × condition       |
| Governs             | **organization administration only** — invite/remove members, org settings, ownership transfer | **all feature capabilities**               |
| Editable at runtime | no                                                                                             | yes                                        |

`member.role` never gates a feature. It answers only "may you administer this
organization?" — which is exactly what the Better Auth organization plugin uses
it for, so removing it would mean rebuilding member management for no gain.

A third thing shares the word "role" and means something else again:
`user.role` is the **platform** tier, owned by the Better Auth admin plugin
(`superadmin` / `admin` / `user`). Three separate concepts, three separate
columns:

```
user.role     → platform tier      (Q0)  — Better Auth admin plugin
member.role   → org administration       — Better Auth organization plugin
user_role     → capability grants  (Q3)  — this kernel
```

---

## Part 4 — Architecture

### 4.1 The package

A new library package, following the repo rule that reusable backend
infrastructure lives in `packages/backend/*`:

```
packages/backend/authz/                    # @oppenheimer/backend-authz
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── index.ts
    ├── registry/
    │   ├── resource-definition.ts         # ResourceDefinition type + defineResource()
    │   ├── resource-registry.ts           # @Injectable registry, boot-time collection
    │   └── catalog.ts                     # registry → catalog DTO projection
    ├── scope/
    │   ├── access-scope.ts                # AccessScope type + helpers
    │   ├── scope-resolver.port.ts         # ScopeResolver interface + DI token
    │   ├── infrastructure/scope-context.types.ts  # request-scoped holder
    │   └── apply-access-scope.ts          # AccessScope + ResourceDefinition → SQL predicate
    ├── ability/
    │   ├── build-ability.ts               # deny-ordered CASL build
    │   └── interpolate.ts                 # ${user.*} / ${scope.*} placeholders
    ├── guards/
    │   ├── policies.guard.ts
    │   ├── platform-admin.guard.ts
    │   ├── authorize-resource.interceptor.ts
    │   └── decorators.ts                  # @CheckPolicies @NoPolicy @PlatformAdmin @AuthorizeResource
    ├── grants/
    │   ├── can-grant.ts                   # role-rule containment
    │   └── can-grant-scope.ts             # access-grant containment
    ├── authz.module.ts                    # forRoot() + forFeature()
    └── testing/
        └── expect-ability.ts              # fluent assertion harness
```

`package.json` mirrors `packages/backend/cache` exactly (that is the established
template — `tsc -p tsconfig.json`, `main: ./dist/index.js`, tsconfig extending
`@oppenheimer/tsconfig/tsconfig.nestjs.json`). The `pnpm-workspace.yaml` glob
`packages/backend/*` already covers the directory, so no workspace edit is
needed.

Dependencies: `@casl/ability`, `@nestjs/common`, `@nestjs/core`, `typeorm`
(peer, for the query-builder types), `@oppenheimer/shared` (wire contracts),
`@oppenheimer/backend-core` (`AppError`).

### 4.2 Boundaries — what goes where

| Layer                  | Owns                                                                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@oppenheimer/shared`        | **Wire contracts only**: `PermissionDefinition`, the Zod schemas, the catalog response types, the generated scope catalog. Nothing that drags CASL into the web bundle.                        |
| `@oppenheimer/backend-authz` | The engine: registry, scope resolution, ability building, guards, containment checks, test harness. Framework-aware (Nest), persistence-agnostic except for one TypeORM query-builder adapter. |
| `apps/api`             | App-specific wiring only: the Better Auth integration, the `roles` module, the `access-grants` module, the concrete `ScopeResolver`, resource declarations per feature module.                 |
| `@oppenheimer/backend-ddd`   | Gains `ScopedRepositoryBase` (it already owns `RepositoryPort`).                                                                                                                               |

**Dependency-cruiser change required.** The `domain-stays-pure` rule in
`apps/api/.dependency-cruiser.cjs` currently allows domain files to import only
`packages/(backend/ddd|shared)/`. `AccessScope` is a pure contract that domain
code legitimately needs, so extend the allow-list:

```js
pathNot: ['^src/[^/]+/domain/', 'packages/(backend/ddd|backend/authz|shared)/'],
```

Do this in Phase 0, in the same commit that creates the package, so `pnpm arch`
never goes red.

---

## Part 5 — Core contracts

### 5.1 The resource declaration

One object per resource, colocated with the module that owns it. This is the
**only** thing a feature module author writes to get authorization.

```ts
// apps/api/src/leads/leads.resource.ts
import { defineResource } from "@oppenheimer/backend-authz";

export const LeadResource = defineResource({
  /** The CASL subject string. Must be unique across the app. */
  subject: "Lead",
  label: "Leads",
  /** Groups resources in the role-builder UI. */
  group: "crm",

  actions: [
    { name: "read", label: "View leads" },
    { name: "create", label: "Create leads" },
    { name: "update", label: "Edit leads" },
    { name: "delete", label: "Delete leads" },
    { name: "assign", label: "Reassign owner" },
    { name: "export", label: "Export to CSV", sensitive: true },
  ],

  /** Fields the role-builder may offer for field-level grants (CASL `fields`). */
  fields: ["value", "ownerId", "notes"],

  /**
   * Which columns carry the scope keys. This is the load-bearing part: it is
   * what lets the kernel derive BOTH the CASL condition and the SQL predicate
   * from one declaration.
   */
  keys: {
    organization: "organizationId",
    team: "teamId",
    owner: "ownerId",
    id: "id",
  },

  /** Which scope dimensions are meaningful for this resource. */
  scopes: ["organization", "team", "own", "grant"],

  /** The credential-scope group, so API tokens and MCP can reach it. */
  credentialScope: "leads",
});
```

```ts
// packages/backend/authz/src/registry/resource-definition.ts
export type ScopeDimension = "organization" | "team" | "own" | "grant";

export interface ResourceActionDefinition {
  name: string;
  label?: string;
  /** Surfaced with a warning in the role-builder. Not treated specially at runtime. */
  sensitive?: boolean;
}

export interface ResourceKeys {
  /** Column holding the tenant id. Required when `scopes` includes 'organization'. */
  organization?: string;
  /** Column holding the owning team id. Required when `scopes` includes 'team'. */
  team?: string;
  /** Column holding the owning user id. Required when `scopes` includes 'own'. */
  owner?: string;
  /** Primary-key column. Required when `scopes` includes 'grant'. Defaults to 'id'. */
  id?: string;
}

export interface ResourceDefinition {
  subject: string;
  label: string;
  group: string;
  actions: readonly ResourceActionDefinition[];
  fields?: readonly string[];
  keys: ResourceKeys;
  scopes: readonly ScopeDimension[];
  credentialScope?: string;
}

/**
 * Validates a resource declaration at module-load time and returns it frozen.
 * Throwing here means a misdeclared resource fails at boot, not at the first
 * request that happens to exercise the missing key.
 */
export function defineResource(
  definition: ResourceDefinition,
): ResourceDefinition {
  for (const dimension of definition.scopes) {
    const required = {
      organization: "organization",
      team: "team",
      own: "owner",
      grant: "id",
    } as const;
    const key = required[dimension];
    if (!definition.keys[key] && !(dimension === "grant")) {
      throw new Error(
        `Resource "${definition.subject}" declares scope "${dimension}" but no keys.${key} column`,
      );
    }
  }
  return Object.freeze({
    ...definition,
    keys: { id: "id", ...definition.keys },
  });
}
```

`ResourceRegistry` is an `@Injectable` that collects every definition passed to
`AuthzModule.forFeature([...])` and exposes `get(subject)`, `all()`, and
`byGroup()`. It is the single source for:

- `GET /v1/authz/catalog` (role-builder UI),
- permission validation on role writes (unknown subject ⇒ a **warning** in the
  response body, never a rejection — the catalog stays advisory and admins may
  still store any string, exactly as today),
- the scope engine's key mapping,
- the generated credential-scope catalog (§9),
- the policy-coverage test.

`KNOWN_SUBJECTS` / `KNOWN_ACTIONS` in `@oppenheimer/shared` shrink to the kernel's own
subjects and stop being the extension point.

### 5.2 `AccessScope` — Q1 + Q2 resolved

```ts
// packages/backend/authz/src/scope/access-scope.ts

/** Everything the caller may reach, before capabilities are considered. */
export interface AccessScope {
  userId: string;
  /** Active organization. `null` only for platform-tier callers acting globally. */
  organizationId: string | null;
  /** Teams the caller belongs to within the active organization. */
  teamIds: readonly string[];
  /**
   * Explicit grants keyed by resource subject. `'all'` means every row of that
   * type within the organization; a Set means exactly those ids.
   */
  grants: ReadonlyMap<string, ReadonlySet<string> | "all">;
  /**
   * Q0 or `manage all`: skip scoping entirely. Always audited when true, and
   * never set for an impersonated session.
   */
  bypass: boolean;
}
```

```ts
// packages/backend/authz/src/scope/scope-resolver.port.ts
export const SCOPE_RESOLVER = Symbol("SCOPE_RESOLVER");

export interface ScopeResolverPort {
  resolve(input: {
    userId: string;
    organizationId: string | null;
    isPlatformAdmin: boolean;
    hasFullAccess: boolean;
  }): Promise<AccessScope>;
}
```

The default implementation in `apps/api` composes two sources:

1. **Structural** — no new tables. The caller's `member` row gives the active
   organization; `teamMember` gives `teamIds`. This alone satisfies requirements
   1 and 2 of the motivating scenario.
2. **Explicit** — the `access_grant` table (§6.2), for the cases where team
   membership is the wrong axis (requirement 3).

Because `ScopeResolverPort` is an interface behind a DI token, swapping in an
implementation that walks a manager/territory tree instead of a flat team list
is a provider override — no call site changes. That is the hierarchy seam, left
open deliberately without being built.

### 5.3 One declaration, three enforcement points

**(a) CASL conditions** — placeholders extend to the scope:

```ts
// team-scoped read
{ action: 'read', subject: 'Lead', conditions: { teamId: { $in: '${scope.teamIds}' } } }

// own-resource edit
{ action: 'update', subject: 'Lead', conditions: { ownerId: '${user.id}' } }

// explicit grants
{ action: 'read', subject: 'Lead', conditions: { id: { $in: '${scope.grants.Lead}' } } }

// field-level deny
{ action: 'read', subject: 'Lead', fields: ['value'], inverted: true }
```

This requires one change to the existing `interpolateConditions` walker in
`packages/shared/src/permissions/index.ts`: a placeholder currently resolves to
whatever `resolvePath` returns, which already handles arrays fine — but
`scope.grants.Lead` is a `Map` lookup, not a property path. Extend
`AbilityContext` with a `scope` member and special-case the `grants.<Subject>`
segment to read from the map, normalizing `'all'` to _omit the condition
entirely_ (an `$in` against "everything" must not become an empty array, which
would deny everything — this is the single easiest way to get this wrong).

**(b) A SQL predicate** from the _same_ registry metadata:

```ts
// packages/backend/authz/src/scope/apply-access-scope.ts
export function applyAccessScope<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  resource: ResourceDefinition,
  scope: AccessScope,
): SelectQueryBuilder<T> {
  if (scope.bypass) return qb;

  const alias = qb.alias;
  const { keys, scopes } = resource;

  if (scopes.includes("organization") && keys.organization) {
    qb.andWhere(`${alias}.${keys.organization} = :authzOrgId`, {
      authzOrgId: scope.organizationId,
    });
  }

  // Team / own / grant are alternatives, not conjunctions: any one of them
  // being satisfied makes the row visible.
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (scopes.includes("team") && keys.team && scope.teamIds.length > 0) {
    clauses.push(`${alias}.${keys.team} IN (:...authzTeamIds)`);
    params.authzTeamIds = scope.teamIds;
  }
  if (scopes.includes("own") && keys.owner) {
    clauses.push(`${alias}.${keys.owner} = :authzUserId`);
    params.authzUserId = scope.userId;
  }
  if (scopes.includes("grant")) {
    const granted = scope.grants.get(resource.subject);
    if (granted === "all") return qb; // no narrowing
    if (granted && granted.size > 0) {
      clauses.push(`${alias}.${keys.id} IN (:...authzGrantIds)`);
      params.authzGrantIds = [...granted];
    }
  }

  // No clause matched ⇒ the caller can see nothing of this type. Fail closed
  // with an unsatisfiable predicate rather than returning an unfiltered query.
  if (clauses.length === 0) return qb.andWhere("1 = 0");

  return qb.andWhere(`(${clauses.join(" OR ")})`, params);
}
```

The `clauses.length === 0 ⇒ 1 = 0` branch is the whole point. The naive
implementation returns `qb` unchanged when nothing applies, which turns "you
have no access" into "you see everything".

**(c) `ScopedRepositoryBase`** in `@oppenheimer/backend-ddd` folds (b) in by default,
so a module gets filtering without calling anything:

```ts
export abstract class ScopedRepositoryBase<
  Domain,
  Orm extends ObjectLiteral,
> implements RepositoryPort<Domain> {
  protected abstract readonly resource: ResourceDefinition;

  protected scopedQuery(
    scope: AccessScope | undefined,
  ): SelectQueryBuilder<Orm> {
    if (!scope) {
      throw new Error(
        `${this.constructor.name} is scope-enforced but was queried without an AccessScope. ` +
          `Pass the scope from ScopeContext, or use unscopedQuery() with an explicit reason.`,
      );
    }
    return applyAccessScope(
      this.repo.createQueryBuilder(this.alias),
      this.resource,
      scope,
    );
  }

  /** Deliberate bypass. Requires a reason; logged at warn level. */
  protected unscopedQuery(reason: string): SelectQueryBuilder<Orm> {
    /* … */
  }
}
```

The throw is not a dev-only assertion — it throws in production too, because a
scoped repository reached without a scope has no safe default behaviour. The
escape hatch is explicit and named.

**(d) Instance-level authorization** stops being hand-written:

```ts
@Patch(':id')
@Version('1')
@CheckPolicies({ action: 'update', subject: 'Lead' })   // type level  — the guard
@AuthorizeResource({ subject: 'Lead', param: 'id' })    // instance level — the interceptor
async update(/* … */) {}
```

`AuthorizeResourceInterceptor` looks up a registered loader for the subject,
fetches the row **through the scoped repository**, and runs
`ability.can(action, subject('Lead', row))`. A row that does not exist and a row
outside the caller's scope both produce **404, not 403** — consistent with the
existing api-token convention (`.agents/rules/scopes-and-credentials.md`: "someone
else's token is reported as not found, not forbidden, so ids cannot be probed").

---

## Part 6 — Data model and migrations

Three migrations, one per phase. Follow the existing convention: hand-written
SQL through `queryRunner.query`, file named `<timestamp>-<Name>.ts`, class named
`<Name><timestamp>`. Register every new ORM entity in **three** places —
`src/config/data-source.ts`, `src/database/seed.ts`, and the module's
`TypeOrmModule.forFeature`.

### 6.1 `1781400000000-AddOrgScopedRoles.ts` (Phase 1)

```sql
-- Roles become org-ownable. NULL = a global/system template.
ALTER TABLE "role" ADD COLUMN "organizationId" uuid;
ALTER TABLE "role" ADD CONSTRAINT "FK_role_organization"
  FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE;

-- Replace the global unique with a per-tenant one, plus a partial index that
-- keeps global role names unique among themselves.
ALTER TABLE "role" DROP CONSTRAINT "UQ_role_name";
CREATE UNIQUE INDEX "UQ_role_org_name" ON "role" ("organizationId", "name")
  WHERE "organizationId" IS NOT NULL;
CREATE UNIQUE INDEX "UQ_role_global_name" ON "role" ("name")
  WHERE "organizationId" IS NULL;

-- Assignments become org-scoped. NULL = the assignment applies globally
-- (system roles, platform admins).
ALTER TABLE "user_role" ADD COLUMN "organizationId" uuid;
ALTER TABLE "user_role" DROP CONSTRAINT "PK_user_role";
-- Postgres treats NULLs as distinct in a PK, so use a generated surrogate and
-- a partial unique index for the two shapes.
ALTER TABLE "user_role" ADD COLUMN "id" uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE "user_role" ADD CONSTRAINT "PK_user_role" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "UQ_user_role_scoped" ON "user_role" ("userId", "roleId", "organizationId")
  WHERE "organizationId" IS NOT NULL;
CREATE UNIQUE INDEX "UQ_user_role_global" ON "user_role" ("userId", "roleId")
  WHERE "organizationId" IS NULL;
CREATE INDEX "IDX_user_role_user_org" ON "user_role" ("userId", "organizationId");

-- Cache invalidation key, bumped in the same transaction as any role write.
ALTER TABLE "organization" ADD COLUMN "roleVersion" integer NOT NULL DEFAULT 1;
```

Existing rows backfill to `organizationId = NULL`, so behaviour is identical
until roles are deliberately scoped. That is what makes this migration safe to
ship ahead of the rest.

### 6.2 `1781500000000-AddAccessGrants.ts` (Phase 2)

```sql
CREATE TABLE "access_grant" (
  "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" uuid NOT NULL,
  "principalType"  varchar NOT NULL,   -- 'user' | 'team' | 'role'
  "principalId"    uuid NOT NULL,
  "resourceType"   varchar NOT NULL,   -- a registry subject, e.g. 'Lead'
  "resourceId"     uuid,               -- NULL = every resource of that type
  "grantedBy"      uuid NOT NULL,
  "expiresAt"      TIMESTAMP WITH TIME ZONE,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_access_grant" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_access_grant_principal"
    CHECK ("principalType" IN ('user','team','role')),
  CONSTRAINT "FK_access_grant_organization"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE
);

-- The resolver's hot path: "every grant reaching this principal set, in this org".
CREATE INDEX "IDX_access_grant_lookup"
  ON "access_grant" ("organizationId", "principalType", "principalId", "resourceType");
CREATE INDEX "IDX_access_grant_expiry" ON "access_grant" ("expiresAt")
  WHERE "expiresAt" IS NOT NULL;
```

`resourceId` has **no foreign key** deliberately — it is polymorphic, and a
grant must be able to name a row in any module's table.

Expiry is enforced in the resolver's `WHERE` (`expiresAt IS NULL OR expiresAt > now()`),
not by a cleanup job. A sweeper that deletes expired rows is a nice-to-have for
table size; it must never be the thing that makes expiry correct.

### 6.3 `1781600000000-AddAuditLog.ts` (Phase 3)

```sql
CREATE TABLE "audit_log" (
  "id"             uuid NOT NULL DEFAULT gen_random_uuid(),
  "actorId"        uuid,
  "impersonatedBy" uuid,
  "organizationId" uuid,
  "action"         varchar NOT NULL,
  "subject"        varchar NOT NULL,
  "resourceId"     varchar,
  "decision"       varchar NOT NULL,   -- 'allow' | 'deny'
  "usedBypass"     boolean NOT NULL DEFAULT false,
  "correlationId"  varchar,
  "metadata"       jsonb NOT NULL DEFAULT '{}',
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_audit_log" PRIMARY KEY ("id")
);
CREATE INDEX "IDX_audit_log_org_time" ON "audit_log" ("organizationId", "createdAt" DESC);
CREATE INDEX "IDX_audit_log_actor_time" ON "audit_log" ("actorId", "createdAt" DESC);
```

No foreign keys on `actorId` / `organizationId`: an audit row must outlive the
user or tenant it describes. Same reasoning as the outbox's `aggregateId`.

---

## Part 7 — The request pipeline

End to end, in order, with the responsible component:

```
1. ApiAuthGuard          authenticates (session, API token, or OAuth grant)
                         → request.user, request.session, request.credentialScopes

2. PlatformAdminGuard    Q0: if the route is @PlatformAdmin and user.role is a
                         platform role → allow, set scope.bypass, force an audit
                         row. Otherwise fall through.

3. ActiveOrgInterceptor  Q1: resolve the active organization from
                         session.activeOrganizationId, overridable by the
                         X-Active-Organization header — VALIDATED against the
                         caller's `member` rows. An unvalidated header here is a
                         tenant-isolation hole.

4. ScopeContext          Q2: ScopeResolver.resolve(...) → AccessScope, stored
                         request-scoped. One resolution per request.

5. PoliciesGuard         Q3 type level: build the ability (role rules ∪ platform
                         role), check every @CheckPolicies rule. Attach to
                         request.ability. FAILS CLOSED — a route with neither
                         @CheckPolicies nor @NoPolicy is rejected.

6. ScopesGuard           credential layer: @RequireScopes ∩ the credential's
                         effective scopes. Already exists, already fails closed.

7. Handler               queries through the scoped repository, which applies
                         the SQL predicate from AccessScope automatically.

8. AuthorizeResource     Q3 instance level, for single-row routes: load through
   (interceptor)         the scoped repo, ability.can(action, subject(...)),
                         404 on miss.

9. AuditInterceptor      writes an audit_log row for platform actions,
                         impersonated requests, and role/grant mutations.
```

Steps 2–4 are new. Steps 1, 5, 6 exist and are modified. Steps 7–9 are new.

### Closing the fail-open hole (G2), safely

Flipping `PoliciesGuard` to fail closed will break every route that currently
relies on the permissive default (e.g. `GET /users/me`). Sequence it:

1. Add a `@NoPolicy('reason')` decorator — it takes a mandatory string so the
   exemption is self-documenting in the code and greppable in review.
2. Add a test that enumerates every registered route via Nest's
   `DiscoveryService` and asserts each declares `@CheckPolicies` or `@NoPolicy`.
   Run it **reporting only** at first; it prints the list of offenders.
3. Annotate the offenders — most want `@NoPolicy('returns only the caller\'s own identity')`.
4. Flip the guard's default to `throw new ForbiddenException()` and make the
   test fail the build.

Steps 1–3 are behaviour-preserving; only step 4 changes behaviour, and by then
the list is empty.

---

## Part 8 — Grant safety

Two containment checks, same invariant, living side by side in `grants/`.

### 8.1 `canGrant` — role rules

An actor may only place a rule on a role if their own ability already satisfies
it. This is the direct analogue of `grantableScopes` in
`packages/shared/src/scopes/scope.ts:161`, which already protects token minting.

```ts
export function ungrantablePermissions(
  actorAbility: AppAbility,
  requested: readonly PermissionDefinition[],
): PermissionDefinition[] {
  return requested.filter((p) => {
    // A deny is always grantable — narrowing your own reach is safe.
    if (p.inverted) return false;
    // Field-level: the actor must hold the action on every field named.
    if (p.fields?.length) {
      return !p.fields.every((f) => actorAbility.can(p.action, p.subject, f));
    }
    return !actorAbility.can(p.action, p.subject);
  });
}
```

Applied in all four role-mutating use cases: `CreateRoleService`,
`UpdateRoleService`, `UpdateRolePermissionsService`, `AssignUserRolesService`
(for assignment, the check is against the _target role's_ full rule set).
Existing `ADMIN_LOCKOUT` protection stays. An org-scoped role editor can never
touch a row with `organizationId IS NULL`.

### 8.2 `canGrantScope` — access grants

A grant is a privilege transfer exactly as a role rule is, and
`resourceId = NULL` ("every resource of this type") is the strongest thing the
table can express. So the grant endpoints ship **with** their containment check,
in the same phase — not a phase later.

```ts
export function canGrantScope(
  actorScope: AccessScope,
  grant: AccessGrantInput,
): boolean {
  if (actorScope.bypass) return true;
  if (grant.organizationId !== actorScope.organizationId) return false;

  const held = actorScope.grants.get(grant.resourceType);
  if (grant.resourceId === null) return held === "all"; // only an 'all' holder may mint 'all'
  if (held === "all") return true;
  return held?.has(grant.resourceId) ?? false;
}
```

Plus: the named principal (`user` / `team` / `role`) must belong to the active
organization, checked against `member` / `team` / `role` respectively.

### 8.3 New error codes

Following the per-module catalog convention. Add rows to
`apps/docs/docs/errors.md` — that is required, not optional.

| Code        | Message                                                       | Status |
| ----------- | ------------------------------------------------------------- | ------ |
| `ROLE_005`  | A role cannot be granted permissions its author does not hold | 403    |
| `ROLE_006`  | A role belonging to another organization cannot be modified   | 403    |
| `GRANT_001` | Access grant not found                                        | 404    |
| `GRANT_002` | An access grant cannot exceed the granter's own access        | 403    |
| `GRANT_003` | The named principal does not belong to this organization      | 400    |
| `AUTHZ_001` | The active organization is not one of your memberships        | 403    |
| `AUTHZ_002` | This route declares no authorization policy                   | 500    |

`AUTHZ_002` is a 500 on purpose: a route reaching production without a policy
declaration is a programming error, not a client error, and it should page
someone rather than look like a permissions problem.

---

## Part 9 — `@oppenheimer/shared` and the generated catalog

The registry lives in the API process. Two consumers cannot see it, and
pretending otherwise would ship resources that are invisible to exactly the
credentials meant to reach them:

- **An MCP server is a separately deployed process** with a static `ToolDefinition`
  registry whose `requiredScopes` are hand-written, filtering its tool list
  against them. It never talks to the API's boot registry.
- **`Scope` in `@oppenheimer/shared` is a compile-time union** (`SCOPE_RESOURCES` ×
  access level) that the CLI, the web picker and the MCP tools type-check
  against. A runtime-only registry cannot produce a compile-time type.

So the mechanism is **codegen, one direction, checked in**:

```
defineResource(...)  ──build step──▶  packages/shared/src/scopes/catalog.generated.ts
                                      (SCOPE_RESOURCES, PERMISSION_GROUPS, Scope)
                                              │
                        ┌─────────────────────┼─────────────────────┐
                     apps/api             MCP server             apps/web
                @RequireScopes(...)   requiredScopes: [...]    permission picker
                   (explicit)            (explicit)              (derived)
```

- A `pnpm generate:scope-catalog` script boots the Nest app in a no-listen mode,
  reads the registry, and emits the file. Same shape of contract as
  `pnpm generate:api-client`; CI regenerates and fails on drift.
- `@RequireScopes` on routes and `requiredScopes` on MCP tools stay **explicit,
  hand-written declarations** — validated against the generated catalog, never
  inferred from it. That preserves `ScopesGuard`'s fail-closed property (a route
  with no decorator stays unreachable by scoped credentials, which is the safe
  failure) and turns the endpoint/tool scope mismatch that
  `scopes-and-credentials.md` warns about into a build failure.
- A test asserts: every registry resource with a `credentialScope` has a
  matching group; every route's `@RequireScopes` names a real scope; every MCP
  tool's `requiredScopes` matches the `@RequireScopes` of the endpoint it calls.

What the registry buys is that the **source** of the catalog moves from a
hand-maintained literal in `@oppenheimer/shared` to the module that owns the resource.
The declarations stay; the drift between two hand-written lists goes away.

Also in `@oppenheimer/shared`:

- `packages/shared/src/schemas/authz.schema.ts` — Zod schemas for the catalog
  response, grant CRUD, and the org-scoped role payloads. **No message strings**
  (`.agents/rules/forms.md`); any new `validation.*` key needs a case in
  `createZodErrorMap`, a `ValidationMessageKey` entry, and every locale.
- A narrow export subpath (`@oppenheimer/shared/authz`) so `apps/web` can import the
  types without pulling CASL into the bundle, and an `optimizeDeps.include`
  entry in `apps/web/vite.config.ts` for dev.

---

## Part 10 — Caching and performance

Two halves with different invalidation properties. **They must not share a cache
entry.**

**Role rules — cached.** App-owned, written through our own aggregates. Key:
`authz:v{org.roleVersion}:{userId}:{orgId}`. Any role or assignment write bumps
`organization.roleVersion` **in the same transaction as the write**.

Not via the outbox: `OutboxService.wake()` swallows delivery failures by design
("rows stay pending for the next poll",
`packages/backend/ddd/src/outbox/outbox.service.ts:247`), which makes
outbox-driven invalidation eventually consistent. Fine for notifying listeners;
not a mechanism to hang permission revocation on.

**Structural scope — never cached.** Team membership is owned by Better Auth:
`WorkspacesService.addMember` / `removeMember` call `auth.api.addTeamMember` /
`removeTeamMember` (`apps/api/src/organizations/workspaces.service.ts:106-127`),
writing the `teamMember` table outside any app transaction and staging nothing
on the outbox. A cached `teamIds` would keep granting a removed member that
team's rows until some unrelated authorization write happened to bump the
version. Resolving per request is two indexed lookups (`member`, `teamMember`)
against rows already hot in the pool — cheaper than the bug.

**Explicit grants — not cached initially.** App-owned and therefore
version-bumpable, but they are the Q2 dimension where revocation is most
security-sensitive. Resolve per request until a measurement says otherwise.

**Per-request memo regardless.** `AbilityFactory` has four call sites in the
request path (`PoliciesGuard` plus three api-token handlers). Memoize on the
request object so one request builds one ability and resolves one scope.

Budget: the target is **≤ 3 queries per authorized request** (roles cached →
member + teamMember + grants). Add a test asserting the query count on a
representative route; it is the only way this stays true.

---

## Part 11 — Web (`apps/web`)

### 11.1 Role builder

New route `apps/web/src/routes/_authenticated/settings/roles.tsx`, plus a
`RoleBuilder` component modelled directly on the existing
`apps/web/src/components/permission-picker.tsx` — it already solves the same
problem for credential scopes (grouped resources, mutually exclusive levels,
disabled what you cannot grant).

Driven entirely by `GET /v1/authz/catalog`, which returns the same shape the
token screen already consumes:

```jsonc
{
  "groups": [
    {
      "group": "crm",
      "label": "CRM",
      "resources": [
        /* ResourceDefinition[] */
      ],
    },
  ],
  "grantable": [
    /* the rules this caller may grant, from canGrant */
  ],
}
```

Three levels of progressive disclosure, so the common case stays a grid of
checkboxes:

1. **Matrix** — resources × actions, checkbox per cell.
2. **Scope** per row — a select: Everyone in org / My teams / Only mine /
   Specific records.
3. **Fields** — an expander per row, only for resources declaring `fields`.

Anything the caller cannot grant renders disabled with the reason, mirroring the
API rule exactly as the token picker already does.

### 11.2 Org switcher and the active-org header

`X-Active-Organization` must be attached by the shared HTTP layer in
`@oppenheimer/api-client`, not per call site. Wire it from the org-switcher store so
the header and `session.activeOrganizationId` cannot drift.

### 11.3 Frontend business logic

Per the repo rule, role logic belongs to the control plane's product package —
add an `authz` module to that package, beside its `admin-users` and `roles`
modules, exposing the catalog query, role mutations,
and grant management. App components stay
presentational. TanStack Query keys follow `apps/docs/docs/architecture/query-keys.md`.

### 11.4 Mobile

No mobile work. A mobile client consumes the API and is unaffected; the role
builder is an admin surface and stays web-only.

---

## Part 13 — Testing

Five layers. The kernel is not done until all five exist.

**1. Unit — the ability builder.** Deny ordering (§G9): denies sort last across
the union of all roles, so a `cannot` in one role is never overridden by a `can`
in another. Placeholder interpolation, including the `'all'` grant case that
must _omit_ the condition rather than emit an empty `$in`.

**2. Unit — `applyAccessScope`.** Table-driven over the cross product of
declared scopes × scope contents. The critical case: no clause matched ⇒
`1 = 0`, never an unfiltered query.

**3. The `expectAbility` harness.** A fluent, readable assertion API so policy
tests are cheap enough that people write them:

```ts
expectAbility(role, { user, scope })
  .can("read", "Lead")
  .cannot("export", "Lead")
  .cannot("read", "Lead", "value")
  .canOn("update", lead({ ownerId: user.id }))
  .cannotOn("update", lead({ ownerId: "someone-else" }));
```

**4. Route coverage tests.** Two enumerations over `DiscoveryService`: every
route declares `@CheckPolicies` or `@NoPolicy`; every route declares
`@RequireScopes` or `@AllowAnyScope`. Both fail the build.

**5. Integration (needs Docker).** The `leads` module end to end:

- a member of team A cannot read team B's leads through the list endpoint,
  the detail endpoint, the export endpoint, an API token, or an MCP tool —
  **each path asserted separately**, because "the list filters but the detail
  doesn't" is the exact bug class this design targets;
- an expired grant stops working without any cleanup job running;
- removing someone from a team revokes their access on the **next request**
  (this is the regression test for §10 — it fails if anyone caches `teamIds`);
- an org admin cannot escalate: creating a role with `manage all` is rejected
  with `ROLE_005`;
- a platform-admin action writes an `audit_log` row with `usedBypass = true`.

---

## Part 14 — Delivery phases

Five phases. Each ends green (`pnpm check`, `pnpm test`, `pnpm arch`), ships
independently, and is behaviour-preserving unless the phase says otherwise.
Every phase that touches the API surface ends with `pnpm generate:api-client`
and a changeset.

### Phase 0 — Kernel foundations _(no behaviour change)_

| #    | Task                                                                                                                                       | Files                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 0.1  | Create `@oppenheimer/backend-authz` from the `backend/cache` template                                                                            | `packages/backend/authz/{package.json,tsconfig.json,README.md}`                   |
| 0.2  | Extend the `domain-stays-pure` allow-list                                                                                                  | `apps/api/.dependency-cruiser.cjs`                                                |
| 0.3  | Move the ability builder + interpolation in, re-export from the old paths                                                                  | `packages/backend/authz/src/ability/`, `packages/shared/src/permissions/index.ts` |
| 0.4  | Deny ordering + test                                                                                                                       | `build-ability.ts`                                                                |
| 0.5  | `defineResource`, `ResourceRegistry`, `AuthzModule.forRoot/forFeature`                                                                     | `src/registry/`                                                                   |
| 0.6  | Declare the kernel's own subjects (`User`, `Role`, `Organization`, `Workspace`, `Member`, `Invitation`, `ApiToken`, `Billing`, `AuditLog`) | `apps/api/src/*/[module].resource.ts`                                             |
| 0.7  | `GET /v1/authz/catalog` + response DTO + Swagger                                                                                           | `apps/api/src/authz/queries/find-catalog/`                                        |
| 0.8  | Per-request ability memo                                                                                                                   | `ability.factory.ts`                                                              |
| 0.9  | `@NoPolicy('reason')` + route-coverage test in **report-only** mode                                                                        | `guards/decorators.ts`, `apps/api/src/__tests__/route-coverage.spec.ts`           |
| 0.10 | Annotate the offenders the test lists                                                                                                      | various controllers                                                               |
| 0.11 | Flip `PoliciesGuard` to fail closed; test now fails the build                                                                              | `policies.guard.ts`                                                               |
| 0.12 | `expectAbility` harness                                                                                                                    | `src/testing/`                                                                    |

**Done when:** the catalog endpoint returns the kernel's subjects, no route is
unannotated, and the guard rejects an unannotated route.

### Phase 1 — Tenancy (Q1)

| #   | Task                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------- |
| 1.1 | Migration `1781400000000-AddOrgScopedRoles.ts`; entities registered in all three places                  |
| 1.2 | `RoleEntity` / `RoleOrmEntity` / mapper gain `organizationId`                                            |
| 1.3 | `AbilityFactory.createForUser(user, { organizationId })` unions global + org-scoped roles                |
| 1.4 | `ActiveOrgInterceptor`: `X-Active-Organization` validated against `member` rows; `AUTHZ_001` on mismatch |
| 1.5 | Role endpoints become org-aware; `ROLE_006` for cross-org edits; global roles are platform-admin only    |
| 1.6 | Role-rule cache keyed on `organization.roleVersion`, bumped in the write transaction                     |
| 1.7 | `@oppenheimer/api-client` header wiring + web org switcher                                                     |

**Done when:** two organizations can each hold a distinct `manager` role, and a
role granted in one has no effect in the other.

### Phase 2 — The scoping engine (Q2) — _the reusable core_

| #    | Task                                                                                   |
| ---- | -------------------------------------------------------------------------------------- |
| 2.1  | `AccessScope`, `ScopeResolverPort` + DI token, `ScopeContext` (request-scoped)         |
| 2.2  | Default resolver in `apps/api`: `member` + `teamMember` lookups, per request, uncached |
| 2.3  | Migration `1781500000000-AddAccessGrants.ts` + `access-grants` module (DDD slice)      |
| 2.4  | `canGrantScope` **in this phase**, wired into grant create/update                      |
| 2.5  | Grant endpoints: `GET/POST /v1/access-grants`, `DELETE /v1/access-grants/:id`          |
| 2.6  | Resolver reads grants (with the expiry predicate) into `AccessScope.grants`            |
| 2.7  | `${scope.*}` placeholders, including array `$in` and the `'all'` omission case         |
| 2.8  | `applyAccessScope` + tests                                                             |
| 2.9  | `ScopedRepositoryBase` in `@oppenheimer/backend-ddd` + the unscoped-query throw              |
| 2.10 | `@AuthorizeResource` interceptor + loader registry, 404 on out-of-scope                |

**Done when:** a resource declaring `scopes: ['organization','team']` is filtered
correctly with zero authorization code in its handlers, and a scoped repository
queried without a scope throws.

### Phase 3 — Governance (Q0 + safety)

| #   | Task                                                                                               |
| --- | -------------------------------------------------------------------------------------------------- |
| 3.1 | `canGrant` across all four role-mutating use cases; `ROLE_005`                                     |
| 3.2 | Migration `1781600000000-AddAuditLog.ts` + `audit` module                                          |
| 3.3 | `AuditInterceptor`: platform actions, impersonated requests, role/grant mutations; denials sampled |
| 3.4 | `@PlatformAdmin()` guard formalized as the Q0 short-circuit                                        |
| 3.5 | Impersonated sessions inherit the target's scope, **never** `bypass`, and always audit             |
| 3.6 | `GET /v1/audit-logs` (org-scoped, read-only, `AuditLog` subject)                                   |

**Done when:** no user can grant a permission they lack, and every bypass leaves
a row.

### Phase 4 — Surfaces and the reference module

| #   | Task                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1 | `pnpm generate:scope-catalog` + `catalog.generated.ts` + CI drift check                                                                                 |
| 4.2 | Consistency test: registry ↔ `@RequireScopes` ↔ MCP `requiredScopes`                                                                                    |
| 4.3 | Role builder UI + an `authz` module in the control plane's product package                                                                                    |
| 4.4 | Grants management UI                                                                                                                                    |
| 4.5 | CLI `roles` + `grants` command groups                                                                                                                   |
| 4.6 | MCP read-only authz tools                                                                                                                               |
| 4.7 | **The `leads` reference module**, end to end                                                                                                            |
| 4.8 | Docs: rewrite `.agents/rules/rbac-roles.md`; add `apps/docs/docs/architecture/authorization.md`; add every new error code to `apps/docs/docs/errors.md` |

#### 4.7 in detail — the reference module

`apps/api/src/leads/`, scaffolded with the `/scaffold-module` skill so it is
DDD-compliant from the start, then:

- `leads.resource.ts` — the declaration from §5.1;
- `LeadOrmEntity` with `organizationId`, `teamId`, `ownerId`, `value`, `notes`;
- `LeadRepository extends ScopedRepositoryBase`;
- controllers with `@CheckPolicies` + `@RequireScopes` + `@AuthorizeResource`;
- a seed adding two orgs × two teams × leads in each;
- the integration suite from §13.5.

This is simultaneously the proof the kernel is reusable, the copy-paste template
for the next module, and the regression suite for the whole design. It is not
optional, and it is not last-if-there-is-time.

> **Since removed.** `leads` was built and proved the kernel, then taken out
> of Oppenheimer along with the starter's Stripe `billing` module: a CRM
> record is a product's domain, and this one is not Oppenheimer's. The
> kernel's own suites in `packages/backend/authz` hold what it proved, and
> the control plane's scoped resources (`hosts`, `projects`, `sessions`,
> installations) are the worked examples now.

### Deliberately out of scope

ReBAC / Zanzibar-style relation tuples, an external policy engine (OPA, Cedar),
per-request policy compilation, and role inheritance hierarchies. Oppenheimer's scale
does not justify them. The kernel keeps the door open: `ScopeResolverPort` and
the ability builder are the two seams an external engine would replace.

---

## Part 15 — Risks and rollback

| Risk                                                                        | Mitigation                                                                                                             |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Flipping `PoliciesGuard` to fail closed locks out a route nobody remembered | The report-only test enumerates every offender _before_ the flip. Phase 0 ordering exists for this.                    |
| The org-scoped role migration breaks existing installs                      | Backfills to `NULL` = today's global behaviour. Reversible `down()`. No app code reads the column until 1.3.           |
| A scoped repository throwing in production takes down a working endpoint    | Ships in Phase 2 with only `leads` using it. Existing repositories are untouched until deliberately migrated.          |
| Query-count regression from per-request scope resolution                    | The ≤3-query budget test in §10. If it regresses, the fix is a grant cache — not caching `teamIds`.                    |
| Codegen drift between the registry and the checked-in catalog               | CI regenerates and fails on diff, same contract as `generate:api-client`.                                              |
| `X-Active-Organization` trusted without validation                          | 1.4 validates against `member` rows and returns `AUTHZ_001`. Cover it with an integration test that forges the header. |

**Rollback.** Phases 0–1 are additive and revertible by migration `down()`.
Phase 2's guard rail is opt-in per repository. Phase 3's audit writes are
append-only and safe to leave. The only one-way door is the fail-closed guard
flip (0.11) — and by then the route list is provably complete.

---

## Part 16 — Definition of done

- [ ] A new module gets tenant isolation, team scoping, row filtering, a
      role-builder entry, and an API-token scope by writing **one**
      `defineResource` call and extending `ScopedRepositoryBase`.
- [ ] No route reaches production without an explicit policy declaration.
- [ ] No user can grant a capability or a grant they do not themselves hold.
- [ ] Removing someone from a team revokes their access on the next request.
- [ ] Every cross-tenant access leaves an audit row.
- [ ] All six requirements from §1 hold for `leads`, asserted on every access
      path — REST, generated client, API token, MCP tool, CLI.
- [ ] `.agents/rules/rbac-roles.md` describes the built system, not this plan.
