---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": minor
---

`/schedule`, the fourth built-in command for bots
(`product/versions/mvp/25-bots.md` §4.1): the bot saves a routine from the
person's words, what to do and when.

- `@oppenheimer/shared`: `schedule` joins `BOT_BUILT_IN_COMMANDS`;
  `botScheduleCommandOf` reads `/schedule <request>` and `/schedule` alone.
- `@oppenheimer/api`: the turn of `/schedule <request>` tells the bot to save
  the routine with `update_routine`, pointing a request for minutes at
  `/loop`; in that turn a `create` raises no card (`routineCallAsks`), read
  from the command the turn ran (`BotToolCallContext.ranCommand`).
  `/schedule` alone is refused as a message.
- `@oppenheimer/web`: `/schedule` in the `/` menu; `/schedule` alone opens
  the bot's Routines tab.
- `@oppenheimer/translations`: `bots.chat.slash.builtIn.schedule`.
