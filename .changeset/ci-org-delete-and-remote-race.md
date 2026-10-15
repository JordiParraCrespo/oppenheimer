---
"@oppenheimer/api": patch
"@oppenheimer/runner": patch
---

Deleting a workspace takes its projects with it (`FK_project_organization` is
now `ON DELETE CASCADE`), so the delete no longer fails on the Unassigned
project every workspace has; a workspace with sessions still refuses. The
runner waits for a store's background deepen to land before rewriting the
store's remote, instead of failing on the config lock the deepen holds.
