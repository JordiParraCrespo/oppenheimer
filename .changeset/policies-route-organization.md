---
"@oppenheimer/api": patch
---

Organization-scoped routes authorize in the organization they name, other routes in the session's organization; a malformed organization id is `AUTHZ_003`, and the unused `X-Active-Organization` header (`AUTHZ_001`) is gone.
