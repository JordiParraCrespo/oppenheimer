---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
---

Enforce conditional User permissions against the loaded record before reading
or updating it. Listing the global user directory now requires `manage User`.
The shared `canAccess()` helper performs the instance-level check.

Preserve the default role's existing restrictions: it has no platform User
grants, and self-service edits go through `/profile`. The existing
`TightenDefaultUserRole` migration already removes unconditional User grants;
no earlier scoping migration is introduced, as that would cause those grants
to survive the later tightening migration. Explicit conditional grants remain
supported, and profile update schemas continue to exclude `role`.

Non-admin callers that previously listed users with only `read User` now
receive 403; organization-scoped member endpoints cover tenant directories.
