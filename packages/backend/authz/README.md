# @oppenheimer/backend-authz

The authorization kernel. A feature module declares one object about its
resource and gets tenant isolation, team scoping, row-level SQL filtering, a
role-builder entry and a credential scope — without writing an authorization
check.

## The four questions

Authorization answers four separate questions, and all of them have to pass:

| #      | Question                     | Mechanism                                        |
| ------ | ---------------------------- | ------------------------------------------------ |
| **Q0** | Is this a platform operator? | Better Auth admin role — a short-circuit         |
| **Q1** | Which tenant's data?         | `organizationId` + the active-org context        |
| **Q2** | Which slice within it?       | `AccessScope`: team membership ∪ explicit grants |
| **Q3** | What may you do to it?       | Dynamic CASL RBAC, org-scoped roles              |

Q1 and Q2 decide **which rows**; Q3 decides **what you may do to them**. Keeping
them separate is what lets "a chatter may send messages, but only for their
assigned accounts" be two independent facts rather than a combinatorial mess.

## Adding a resource

Two steps. There is no third.

**1. Declare it**, next to the module that owns it:

```ts
export const LeadResource = defineResource({
  subject: "Lead",
  label: "Leads",
  group: "crm",
  actions: [
    { name: "read" },
    { name: "update" },
    { name: "export", sensitive: true },
  ],
  fields: ["value", "notes"],
  keys: { organization: "organizationId", team: "teamId", owner: "ownerId" },
  scopes: ["organization", "team", "own", "grant"],
  credentialScope: "leads",
});
```

`keys` is the load-bearing part: it is what lets the kernel derive **both** the
CASL condition and the SQL predicate from one place, so a query and an
`ability.can()` cannot disagree about what a scope means.

**2. Extend the scoped repository:**

```ts
@Injectable()
export class LeadRepository extends ScopedRepositoryBase<LeadOrmEntity> {
  protected readonly resource = LeadResource;
  protected readonly alias = "lead";

  findAll(scope: AccessScope) {
    return this.scopedQuery(scope).getMany();
  }
}
```

Then register the declaration with `AuthzModule.forFeature([LeadResource])` and
protect routes with `@CheckPolicies` + `@RequireScopes` as usual.

## Why it fails closed

Three places where the obvious implementation is the dangerous one:

- **`applyAccessScope` with no matching dimension emits `1 = 0`.** Returning the
  query builder untouched — the natural thing to write — turns "you have no
  access" into "you see everything".
- **`scopedQuery` throws without a scope.** Not a dev-only assertion: a
  scope-enforced repository reached without a scope has no safe default. The way
  out is `unscopedQuery(reason)`, which is named and greppable.
- **An empty `teamIds` resolves to `[]`, never `undefined`.** `$in: undefined`
  matches unpredictably; `$in: []` matches nothing, which is the honest reading
  of "you belong to no teams".

## Deny precedence

CASL is last-rule-wins, and a user's permissions are the union of several roles
in whatever order the database returned them. `denyLast` (in `@oppenheimer/shared`)
applies every `cannot` after every `can`, so a deny in one role is never
silently overridden by a grant in another. Without it the effective ability
would depend on row order.

## No privilege escalation

`canGrant` and `canGrantScope` enforce that nobody hands out reach they do not
hold. They are the role-side and grant-side twins of `grantableScopes`, which
already protects credential minting. Without them, `update Role` is effectively
`manage all`: compose the role, assign it to yourself, done.

## Testing

```ts
expectAbility(role.permissions, { user, scope })
  .can("read", "Lead")
  .cannot("read", "Lead", "value")
  .canOn("update", "Lead", { ownerId: user.id })
  .cannotOn("update", "Lead", { ownerId: "someone-else" });
```

Assert **both** layers. The SQL predicate decides which rows come back; the CASL
ability decides what `can()` reports to the UI. They are generated from one
declaration, and testing only one of them lets the other drift.

## What is not here

Ability _building_ lives in `@oppenheimer/shared`, not in this package: the scope
catalog there consumes `AppAbility`, so moving the builder here would make the
two packages mutually dependent. This package owns everything around the
engine — the registry, scope resolution, guards, containment and the harness.
