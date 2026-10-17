---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
---

Bots, `create_bot` (`product/versions/mvp/25-bots.md` §4.6).

- `@oppenheimer/api`: the `create_bot` tool, which asks under Approve for me.
  It dispatches the console's create command as the owner, with the name,
  description, soul, instructions, provider, model, effort, permission and
  group; the provider and model default to the creator's, a provider with no
  workspace key is refused, and the permission is never looser than the
  creator's. `bot."createdByBotId"` marks the creator, and `bot."idempotencyKey"`
  makes a retried or racing creation make one bot.
- `@oppenheimer/api-client`: `createdByBotId` on the bot.
