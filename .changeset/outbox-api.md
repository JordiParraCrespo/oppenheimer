---
"@oppenheimer/api": minor
---

Domain events and queued jobs are staged in the same transaction as the write that owes them, so a crash between commit and dispatch no longer drops them.
