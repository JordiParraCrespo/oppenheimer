---
"@oppenheimer/api": minor
---

New `AuthErrors`, `OrganizationErrors` and `AdminErrors` catalogs; `betterAuthInvoker` folds Better Auth's upstream codes onto them, and the guards throw catalog errors — a missing principal is now 401 rather than 403.
