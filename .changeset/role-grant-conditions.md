---
"@oppenheimer/backend-authz": patch
"@oppenheimer/shared": patch
"@oppenheimer/api": patch
---

Role grants respect CASL conditions, and platform roles resolve from global rows only.

- `@oppenheimer/backend-authz`: `ungrantablePermissions` and `canGrant` take the
  context the actor's ability was built with and check that each requested
  rule is contained in one of the actor's rules, conditions included. An actor
  who holds `manage Session` only for their own organization can no longer
  write unconditioned `manage Session`, or the rule for another organization,
  onto a role or assign a role that carries it. `describePermission` shows a
  rule's conditions.
- `@oppenheimer/shared`: new `interpolatePermissionConditions`, which resolves a
  stored rule's `${...}` placeholders the way the ability builder does.
- `@oppenheimer/api`: role create, update, update-permissions and assignment
  reject such rules with `ROLE_005`, and the detail says whether the caller
  lacks the rule or holds it only under narrower conditions. The role
  catalog's `grantable` list uses the same check. A Better Auth platform role
  (`user.role`) is looked up among global roles only, so a tenant role of the
  same name is never used in its place.
