---
"@oppenheimer/api": patch
"@oppenheimer/backend-core": patch
"@oppenheimer/backend-authz": patch
---

Authorization stops re-reading roles on every request.

- `@oppenheimer/api`: a user's role-derived permissions are cached in Redis,
  keyed on three version counters read in one query per request — the
  organization's `roleVersion`, the new `role_catalog_version` (global roles)
  and `user_role_version` (a user's global assignments), added by migration
  `AddAuthzVersions`. Every role and assignment write bumps the counter that
  covers it in its own transaction, so a revocation is visible on the next
  request on every replica. Platform roles resolve from an in-process snapshot
  of the global roles; the access-scope interceptor reuses the role ids the
  ability was built from and reads team membership in one join. A warm
  guarded, scoped request makes 3 authorization queries instead of 6. Redis
  failing falls back to the database.
- `@oppenheimer/backend-core`: `requestMemo(request, key, compute)`, one
  in-flight computation per key per request, evicted on rejection.
- `@oppenheimer/backend-authz`: `ResolveScopeInput.roleIds`, optional, for a
  caller that already knows the roles.
