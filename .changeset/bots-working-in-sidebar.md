---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
---

A bot at work reads as one in the sidebar, as a working session does: while a turn of its is queued or running, its name shimmers and the green dot shows on its face. `GET /v1/working-bots` lists the bots with a turn queued or running, on the bots the caller may read; a turn queued or ended raises `BotTurnChangedDomainEvent`, which the workspace stream sends as `botTurn.changed { id, botId }`, and the console reads the list again on it (polling every 15 seconds while the stream is down).
