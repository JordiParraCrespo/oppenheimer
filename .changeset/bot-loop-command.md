---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/api-client": minor
---

`/loop`, the third built-in command for bots: a prompt run now and again
every interval, from a minute to a day, or when the bot says, until it is
stopped, the bot ends it or it expires after 3 days
(`product/versions/mvp/25-bots.md` §4.1).

- `@oppenheimer/shared`: `loop` joins `BOT_BUILT_IN_COMMANDS`;
  `botLoopCommandOf` reads `/loop [interval] [prompt]` and `/loop stop`; the
  `BotLoop` and `BotLoopEvent` types, the `loop` turn origin and the
  `BOT_LOOP_*` bounds.
- `@oppenheimer/api`: `bot_loop` (`AddBotLoops`), one per bot, set with the
  `/loop` message's turn; each run a background turn keyed by the loop and
  its number, queued by a delayed job that claims the loop's count and next
  run with it, skipped while the last run is busy; a run's end decides
  whether the loop ends; the bot's `schedule_loop` and `end_loop`;
  `GET` and `DELETE /bots/:id/loop`. `/loop stop` and an interval out of
  range are refused as messages.
- `@oppenheimer/frontend-consumer`: `useBotLoop`, `useClearBotLoop`, loop
  events.
- `@oppenheimer/web`: `/loop` in the `/` menu; the loop over the composer
  with how often it runs, when next and Stop; `/loop stop` runs there; a
  line for each run and for how the loop ended.
- `@oppenheimer/translations`: `bots.chat.loop.*`, `bots.chat.event.loop.*`,
  `bots.chat.slash.builtIn.loop`.
- `@oppenheimer/api-client`: `findBotLoop`, `clearBotLoop`.
