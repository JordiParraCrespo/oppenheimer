---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": patch
---

Bots, slice 1 (`product/versions/mvp/25-bots.md`): a bot without a runtime.

- `@oppenheimer/shared`: `bot.schema.ts` (create and edit a bot and a group,
  save a document over a base revision, a memory fact, the revisions query)
  with `BOT_AVATAR_COLORS`, `BOT_DOCUMENT_NAMES`, the bounds and the default
  soul; the `Bot` subject, the owner's rule on it, the `bots:read` /
  `bots:write` scopes and the bot endpoints in `ENDPOINT_POLICIES`.
- `@oppenheimer/api`: the `bots` module and its migration: `bot`,
  `bot_group`, `bot_document`, `bot_document_revision` and
  `bot_memory_fact`, with `/v1/bots`, `/v1/bot-groups`, a bot's documents and
  revisions (save over a base revision, revert as a new revision) and its
  memory. Errors `BOTS_001`–`BOTS_010`.
- `@oppenheimer/api-client`: the bot operations.
- `@oppenheimer/translations`: `errors.byCode.BOTS_*`.
