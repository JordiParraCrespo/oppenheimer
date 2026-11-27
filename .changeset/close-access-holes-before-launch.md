---
'@oppenheimer/api': patch
'@oppenheimer/api-client': patch
---

Close access holes found in a security review: adding a member needs a platform administrator, a token mints only within its own scopes and workspaces, a preview ticket no longer opens a terminal, a session cannot hide itself from Active sessions, and production refuses a placeholder or short `BETTER_AUTH_SECRET`.
