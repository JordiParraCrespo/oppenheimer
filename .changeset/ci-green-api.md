---
"@oppenheimer/api": patch
---

Point an account's org-less sessions at the personal workspace in the transaction that provisions it. Sign-up's own session was written before the workspace existed, so it carried no active organization and every org-scoped route refused the workspace's owner until they signed in again.
