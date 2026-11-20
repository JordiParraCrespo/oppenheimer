---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/web": minor
---

A bot's sidebar row reads as a session's. Waiting on you (an approval or questions pending, or a failed turn since you last read the chat) is the amber dot; working (a turn queued or running) shimmers the name; a message you have not read, or the row's own Mark as unread, is the blue dot. `GET /v1/bot-activity` lists the bots working and waiting on you; `POST /v1/bots/:id/acknowledge` reads a bot's chat (`bot."acknowledgedAt"`, added by a migration and backfilled to each bot's last message), and each bot carries `unread`. A turn queued or ended raises `BotTurnChangedDomainEvent`, sent on the workspace stream as `botTurn.changed { id, botId }`. `BotItem` takes `working` for the shimmer apart from `live`, its green dot.
