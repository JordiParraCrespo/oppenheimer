---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": patch
---

Bots no longer get a **Heartbeat** routine by default, and the migration
`PauseDefaultBotHeartbeats` pauses every running one, as its owner would, so
it stops spending a model turn an hour (`26-bot-routines.md` §6, "Changed
2026-11-15"). A heartbeat the owner turns back on beats only from 08:00 to
22:00 in the zone they last wrote to the bot from, and skips without a model
turn when nothing happened in the bot's chat since its last beat; the two
new skip reasons are `outside_active_hours` and `idle`. Run now always runs.
