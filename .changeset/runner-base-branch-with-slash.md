---
"@oppenheimer/runner": patch
---

A session cut from a base branch with a slash in its name (`claude/x`) starts:
the base is read from the store's `refs/remotes/origin/`, where it was
fetched, instead of being passed to git as if it were already a full ref,
which failed with "Not a valid object name" or put the worktree on a copy of
the base rather than on the session's own branch.
