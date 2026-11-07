---
'@oppenheimer/backend-authz': patch
'@oppenheimer/api': patch
---

A platform admin, or anyone holding `manage all`, no longer reaches other
people's hosts. A host belongs to a person and has no workspace key, so the
access-scope bypass, which keeps a workspace boundary for every other resource,
removed the owner filter entirely. A platform admin's own New session picker
listed every user's machines on the deployment, and the same scoped read let
them start a session on one, list its folders and its Codex environments.
`applyAccessScope` no longer lets a bypass or an `'all'` grant widen a resource
with no organization key: its rows are the caller's own and the ones granted by
id. `canGrantScope` no longer lets a bypass or an `'all'` holder grant such a
row. Only a row already granted by name can be passed on.
