---
"@oppenheimer/api": minor
---

Bots get `close_session`: a bot can close a session it started, most often one that failed, through the sessions' own close (each branch pushed, the worktree removed, unpushed work kept unless `accept_unpushed_work`). It asks first like the other session tools, and a session the person, an automation or a review started is refused before any card. The `failed` wake now offers it once the person has been told.
