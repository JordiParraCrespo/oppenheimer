---
"@oppenheimer/frontend-consumer": patch
---

A poll that watches something finish (a session start, a run, a pairing)
keeps running while the tab is hidden. `LIVE_POLL` now owns that with the
interval, and a hook spreads `pollWhile()`.
