---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

Skills for bots, run as slash commands (`product/versions/mvp/25-bots.md` §4.1).

- `@oppenheimer/shared`: `botSkillSchema`, `updateBotSkillSchema`, the name
  rules and `parseBotSlashCommand` (`/<name> args` and `/skill <name> args`).
- `@oppenheimer/api`: the `bot_skill` table and `/v1/bots/:id/skills`
  (list, create, update, delete; `BOTS_038` to `BOTS_040`); the bot's
  `use_skill`, `save_skill` and `delete_skill` tools; the prompt's "Your
  skills" list; and a message opening with `/<name>` runs that skill.
- `@oppenheimer/api-client`: the skills operations.
- `@oppenheimer/frontend-consumer`: `BotSkillEntity` and its hooks.
- `@oppenheimer/web`: Settings → Skills, and the composer's `/` menu.
- `@oppenheimer/translations`: their copy, English and Spanish.
