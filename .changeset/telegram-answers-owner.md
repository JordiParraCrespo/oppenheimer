---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

Bots answer their owner on Telegram. A Telegram bot is bound to one of the
owner's Oppenheimer bots (`PATCH /v1/telegram/accounts/:id`), and a one-time
`t.me/<bot>?start=<code>` link (`POST /v1/telegram/accounts/:id/owner-link`)
records the owner's Telegram account. Their messages in their direct chat
start a turn of that bot in a conversation of its own (`bot_conversation`;
`bot_turn` and `bot_message` gain `conversationId`, the console chat's being
the bot's id), and the turn's answer is sent back as a reply. `/new` starts a
fresh conversation, `/stop` stops the running turn, `/help` says how. Anyone
else gets one fixed line a day and reaches no bot; groups are ignored. A bot
that answers on a Telegram bot cannot be deleted (`BOTS_042`). Settings →
Telegram gains an "Answers you" row: the bot that answers, and Link your
Telegram.
