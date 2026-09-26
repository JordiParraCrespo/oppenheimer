---
"@oppenheimer/api": patch
---

Every date column is stored as `timestamptz`, so dates reach clients with their offset and no longer read out by the reader's time zone.
