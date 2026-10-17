---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": patch
---

Bots, slice 2 (`product/versions/mvp/25-bots.md` §2): a bot answers.

- `@oppenheimer/shared`: the provider catalog (`BOT_PROVIDERS`,
  `BOT_PROVIDER_CATALOG`), the provider key schema, the turn and message
  vocabulary (`BOT_TURN_STATUSES`, `BOT_MESSAGE_ROLES`, `sendBotMessageSchema`,
  `BotStreamEvent`) and the `bot-turns` queue.
- `@oppenheimer/api`: a workspace's model provider keys, sealed under
  `BOTS_PROVIDER_KEY` (`/v1/model-providers`); a bot's provider; turns and
  messages (`bot_turn`, `bot_message`), `POST /v1/bots/:id/messages`, Stop,
  `GET /v1/bots/:id/conversation` and the `GET /v1/bots/:id/stream` SSE; the
  `bot-turns` worker running each turn on `@oppenheimer/backend-agents`, one
  per bot at a time. Errors `BOTS_011`–`BOTS_014`.
- `@oppenheimer/api-client`: the provider and chat operations.
- `@oppenheimer/translations`: `errors.byCode.BOTS_011`–`BOTS_014`.
