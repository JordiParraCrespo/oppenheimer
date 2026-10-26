---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Bots in the console's sections (`product/versions/mvp/28-bots-in-sections.md`).

- `@oppenheimer/shared`: `BOT_SECTIONS` (`sessions`, `automations`, `plan`,
  `pulls`), and `sections` on the create and update bot inputs.
- `@oppenheimer/api`: `bot."sections"`, the set of sections whose sidebar lists
  the bot, empty by default; `POST /v1/bots` and `PATCH /v1/bots/:id` take it,
  and `update_profile` lets a bot place itself.
- `@oppenheimer/api-client`: `sections` on the bot.
- `@oppenheimer/frontend-consumer`: `BotEntity.sections` and `showsIn`,
  `useSuspenseSectionBots`, and `useCreateBot` taking the sections.
- `@oppenheimer/web`: a Bots heading in Sessions, Automations, Plan and Pull
  requests, whose plus makes a bot there; a bot's chat inside Pull requests at
  `/pulls/bots/$botId`; Shows in on a bot's Profile.
