---
"@oppenheimer/runner": patch
---

The work folder's guides scale with the workspace, not the host: a create
or close rewrites only its own workspace's guides, under a lock at the root
the daemon and the host's CLI share. A close renames the session folder to
a hidden `.removing-…` name before deleting it, so a guide written by the
other process can no longer make the delete fail and strand the folder
without its marker; one a dead process left is finished at the next start.
