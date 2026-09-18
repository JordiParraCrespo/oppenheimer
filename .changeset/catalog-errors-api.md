---
"@oppenheimer/api": minor
---

Organization, admin and guard failures answer with a catalog `code` instead of a codeless problem document, and `PoliciesGuard` reports a missing principal as 401 rather than 403.
