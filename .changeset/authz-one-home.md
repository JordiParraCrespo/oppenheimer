---
"@oppenheimer/api": patch
---

Authorization lives in one place, `apps/api/src/authz/`. The
`@oppenheimer/backend-authz` package had one consumer and no second
implementation of its one port, so it is folded into the API: the resource
registry, `AccessScope`, the SQL predicate and `ScopedRepositoryBase`, the
containment checks and `@CheckPolicies` now sit beside the access grants,
and `AbilityFactory` (from `roles`) and `PoliciesGuard` (from `auth`) joined
them. `auth` no longer knows about policies at all. No behaviour changes:
the same guards, error codes and caching. The package's unused exports
(`expectAbility`, `AbilityAssertions`, `toAbilityScopeContext`) are gone.
