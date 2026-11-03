---
"@oppenheimer/api": patch
"@oppenheimer/backend-agents": minor
---

A bot's requests stay cacheable from turn to turn
(`product/versions/mvp/25-bots.md` §2). A bot on GPT and Grok read 1% of
its input from the provider's prompt cache.

- `@oppenheimer/backend-agents`: `BotTurnRequest.cacheKey`, a stable id for
  the conversation a turn continues. The OpenAI engine sends it as the
  request's `prompt_cache_key`, so OpenAI, ChatGPT's backend and xAI send a
  turn's steps and the next turn to the server that holds the prefix.
- `@oppenheimer/backend-agents`: `BotCompletionRequest` takes `cacheKey` too.
- `@oppenheimer/api`: a turn names its bot as its cache key, a subagent its
  turn and place (`<turn>:subagent:<n>`), and a call outside a turn its bot
  and purpose (`<bot>:summary`, `<bot>:goal_review`, `<bot>:rule_review`).
  A turn's history loses the oldest messages a block of about 6,000 tokens
  at a time, cut from the oldest forward, so it starts where the last
  turn's did until a whole block no longer fits, instead of losing one
  message every turn.
