---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": patch
"@oppenheimer/web": minor
---

A bot tells the person a line in the Inbox (`product/next-steps/agent-tools.md` §5). Its new `notify` tool keeps the bot's latest line in `bot_notice` (one row per bot, a new id with each notice), raises `botNotice.changed` on the workspace stream, and `GET /v1/bot-notices` reads each bot's notice on the bots the caller may read, newest first, at most 50. The Inbox lists it as a `botNotice` item keyed `botnotice:<bot>:<notice>`, with Open chat and Done, counted under the Type facet's "Bots" (was "Bot approvals").
