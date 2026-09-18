---
"@oppenheimer/api": minor
---

Conditional User permissions are enforced against the loaded record, and listing the global user directory requires `manage User`. A non-admin caller with only `read User` now receives 403; organization-scoped member endpoints cover tenant directories.
