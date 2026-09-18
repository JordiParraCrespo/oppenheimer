---
"@oppenheimer/api": minor
---

Bring every user-facing error into the RFC 7807 catalog.

The organization and admin façades threw bare `HttpException`s carrying Better
Auth's `{ message, code }` body, expecting the code to survive. It did not:
`AllExceptionsFilter` reads a `code` from `AppError` alone, so ~46 call sites
answered with a codeless problem document whose `title` was only the status
phrase ("Conflict"). The auth guards had the same gap.

New `AuthErrors` (`AUTH_001`/`AUTH_002`), `OrganizationErrors`
(`ORG_001`–`ORG_016`) and `AdminErrors` (`ADMIN_001`–`ADMIN_008`) catalogs.
`betterAuthInvoker` folds Better Auth's ~85 upstream codes onto them, keeping
the original as an `upstreamCode` extension member. Guards throw catalog errors
instead of Nest's codeless ones; `PoliciesGuard` now reports a missing
principal as 401 rather than 403.
