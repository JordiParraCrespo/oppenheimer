---
"@oppenheimer/translations": patch
---

Add an `errors.byCode` message for `ROLE_007` (`SYSTEM_ROLE_MISSING`) in both
locales. It had a catalog entry and a docs row but no message, so a missing
system role reached a client as the generic fallback.
