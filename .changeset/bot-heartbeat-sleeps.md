---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": patch
---

Bots no longer get a **Heartbeat** routine by default (`bot-routines.md`
§6, "Changed 2026-11-15"). The migration `PauseDefaultBotHeartbeats` moves
every heartbeat still on its hourly trigger to twice a day, 09:00 and 18:00
in the zone its owner last wrote from, and pauses every running one, so it
stops spending a model turn an hour; the owner turns it back on and changes
its times like any routine. A scheduled beat with nothing new in the bot's
chat since the last one is skipped as `idle` without a model turn. Run now
always runs.
