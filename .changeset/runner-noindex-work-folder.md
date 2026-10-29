---
"@oppenheimer/runner": minor
---

Spotlight stops indexing a Mac host's sessions. A workspace's stores and
sessions move to `repos.noindex/` and `sessions.noindex/` in the work folder
(layout version 3): Spotlight skips a directory whose name ends in `.noindex`,
where the `.metadata_never_index` marker at the root never kept it out, and on
a host with a few sessions open `mdworker_shared` took more CPU than the agents.
There is no migration: a running session keeps the folder it was made in, and a
store left in `repos/` is cloned again on its next create. Delete the old
`repos/` and `sessions/` directories by hand once their sessions are closed.
