---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": minor
"@oppenheimer/api-client": patch
---

Bots get built-in commands, as Claude Code has, and `/goal` is the first
(`product/versions/mvp/25-bots.md` §4.1).

- `@oppenheimer/api`: a message `/goal <condition>` sets the bot's goal on
  the turn it queues, with up to 20 continuations, and that turn starts on
  it. After each turn of a goal, a reviewer on the bot's own model reads the
  conversation and says met, not met or impossible; met and impossible end
  the goal with a line and the reviewer's reason, not met queues the next
  continuation with that reason. A reviewer that fails is no verdict and the
  goal goes on within its limit. `/goal` alone and `/goal clear` are refused
  as messages (`GENERIC.ARGUMENT_INVALID`). `set_goal` takes up to 20
  continuations; `bot_goal` holds a 2,000-character condition
  (`WidenBotGoals`).
- `@oppenheimer/shared`: `BOT_BUILT_IN_COMMANDS`, `botGoalCommandOf` and
  `BOT_GOAL_CLEAR_WORDS`; `goal` is a reserved skill name;
  `BOT_GOAL_ACTIVITIES` gains `met` and `impossible`;
  `BOT_GOAL_OBJECTIVE_MAX` is 2,000, `BOT_GOAL_CONTINUATIONS_MAX` 20, and
  `BOT_GOAL_CONTINUATIONS_PERSON` is new.
- `@oppenheimer/web`: the composer's `/` menu lists the built-ins under
  Commands before the skills; `/goal clear` stops the goal without sending
  anything, and `/goal` with no condition keeps send off. Goal lines draw
  met and impossible, and the reviewer's reason.
- `@oppenheimer/translations`: `bots.chat.goal.needsCondition`,
  `bots.chat.event.goal.met` and `impossible`, `bots.chat.slash.builtInLabel`
  and `builtIn.goal`; `bots.chat.slash.menu` names commands too.
- `@oppenheimer/api-client`: the goal event's `activity` and `reason`.
