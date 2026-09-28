---
"@oppenheimer/api": patch
---

Organization-scoped routes are authorized by the caller's roles in the
organization the path names, not the session's active one: a session with
another organization selected, or an API token not pinned to one, is judged
by its roles where it acts.
