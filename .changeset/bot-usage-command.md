---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/backend-agents": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/api-client": minor
---

`/usage`, the second built-in command for bots: a card of what the chat has
spent, in tokens (`product/versions/mvp/25-bots.md` §4.1).

- `@oppenheimer/backend-agents`: the `usage` event carries `cacheReadTokens`
  and `cacheWriteTokens` (Anthropic's cache reads and writes, the Responses
  API's cached tokens), part of `inputTokens`; `BotEngine.completeWithUsage`
  answers a completion's text with what it spent.
- `@oppenheimer/api`: a turn keeps its cache reads and writes; the calls a
  bot makes outside its turns (goal reviews, summaries, rule reviews) are
  recorded in `bot_model_call` (`AddBotUsage`) by `BotCompletionResolver`;
  `GET /bots/:id/usage` sums a chat's turns by model and its other calls by
  purpose; clearing the chat clears both. `/usage` is refused as a message.
- `@oppenheimer/shared`: `usage` joins `BOT_BUILT_IN_COMMANDS` (a reserved
  skill name); `isBotConsoleCommand`; the `BotUsage` types and
  `BOT_MODEL_CALL_PURPOSES`.
- `@oppenheimer/frontend-consumer`: `useSuspenseBotUsage`.
- `@oppenheimer/frontend-web`: `ChatUsageDetails`, the context and plan
  windows the context meter's popover shows, for a card to draw too;
  `formatTokens`.
- `@oppenheimer/web`: `/usage` in the `/` menu opens the usage card: room
  left, this chat, a breakdown by model, and the calls outside its turns,
  with Copy.
- `@oppenheimer/translations`: `bots.chat.usage.*` and
  `bots.chat.slash.builtIn.usage`.
- `@oppenheimer/api-client`: `findBotUsage`.
