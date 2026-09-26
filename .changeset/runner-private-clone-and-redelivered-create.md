---
"@oppenheimer/runner": patch
---

A session on a private repository clones: the create's own git commands name the session they are for, so the credential helper gets its token, and a clone refused for want of one says so (`GIT_004`) instead of relaying git's "could not read Username". A create no longer runs on the link's read loop or dies with the link: a git command the runner stops waiting for is `GIT_005`, never git's own success text, and a redelivered `session.create` joins the one still running or adopts the worktree an interrupted one left (#77, #79).
