---
"@oppenheimer/runner": minor
---

A repository's store is a blobless clone with no working tree. A session create fetches only the branch its worktree is made from, with no tags and no automatic gc, and takes a spare worktree the runner checked out ahead of it.
