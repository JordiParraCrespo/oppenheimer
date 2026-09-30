---
"@oppenheimer/api": patch
---

Deleting an account no longer fails with a 500 when one of its sessions is appending to its log at the same moment: the erase locks the workspace's sessions before deleting their log, so an append either finishes first or finds no session.
