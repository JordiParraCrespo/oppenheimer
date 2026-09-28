---
"@oppenheimer/runner": patch
---

Deleting a session pushes its branch with that session's GitHub credential. The push used to ask the credential helper for no session, GitHub refused it, and the host kept the worktree and the session instead of deleting it.
