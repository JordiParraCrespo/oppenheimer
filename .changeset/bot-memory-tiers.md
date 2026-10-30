---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot's memory facts have a tier and a scope. A `profile` fact is in the
prompt every turn (the newest 60); a `log` fact is looked up with `recall`.
A `bot` fact is the bot's own; a `person` fact is about its owner, and every
bot that person made in the workspace reads it, while it stays the row of the
bot that learned it. `bot_memory_fact` gains `tier` and `scope`;
`remember` takes `tier` and `about`, the memory routes take and return
`tier` and `scope` (with `botId`), and `PATCH` changes any of the three.
Settings → Memory tags each fact, moves it from its row's menu, and shows
facts the owner's other bots shared, muted and read-only.
