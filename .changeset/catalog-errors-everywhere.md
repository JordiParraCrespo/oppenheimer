---
"@oppenheimer/backend-core": minor
"@oppenheimer/translations": minor
"@oppenheimer/frontend": minor
"@oppenheimer/api-client": patch
---

Bring every user-facing error into the RFC 7807 catalog.

The organization and admin façades threw bare `HttpException`s carrying Better
Auth's `{ message, code }` body, expecting the code to survive. It did not:
`AllExceptionsFilter` reads a `code` from `AppError` alone, so ~46 call sites
answered with a codeless problem document whose `title` was only the status
phrase ("Conflict"). The auth guards had the same gap.

- **`@oppenheimer/backend-core`** — new `ApiAuthProblemResponses()` documents the
  401/403 every guarded route can produce, applied once per controller class.
  A test now pins the deliberate rule that a bare `HttpException` carries no
  `code`.
- **`apps/api`** — new `AuthErrors` (`AUTH_001`/`AUTH_002`), `OrganizationErrors`
  (`ORG_001`–`ORG_016`) and `AdminErrors` (`ADMIN_001`–`ADMIN_008`) catalogs.
  `betterAuthInvoker` folds Better Auth's ~85 upstream codes onto them, keeping
  the original as an `upstreamCode` extension member. Guards throw catalog
  errors instead of Nest's codeless ones; `PoliciesGuard` now reports a missing
  principal as 401 rather than 403.
- **`@oppenheimer/translations`** — new `errors` namespace with a message per code in
  both locales, so clients stop rendering the server's English `detail`.
- **`@oppenheimer/frontend`** — new `createErrorMessageResolver` translating a failure
  from its problem `code`; the organizations repository no longer swallows a
  failed read into an empty list.
- **`@oppenheimer/api-client`** — regenerated; the documented failures now reach the
  OpenAPI document.
