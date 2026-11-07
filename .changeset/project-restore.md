---
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
---

An archived project can be restored. `POST /v1/projects/{id}/restore`
(`restoreProject` in the client) brings the same row back with its slug, so
nothing is reissued, and announces `project.changed`; restoring an active
project changes nothing. The automations its archive paused stay paused.
A bot does it with `restore_project`, which runs like the other project
writes, and `archive_project` no longer says an archive is final.
