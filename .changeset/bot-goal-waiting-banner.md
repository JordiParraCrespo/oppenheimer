---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/shared": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A goal held for a system's rate limit says so on its banner.

- `@oppenheimer/api`: the goal records the wait its next decision is held
  for (`bot_goal."waitingFor"`, `"waitingUntil"`, migration
  `HoldBotGoalOnRateLimit`), set in the transaction that stages the held
  decision and cleared in the one that claims the next continuation;
  `BotGoalResponseDto.waiting` (`{ system, until }`, or null).
- `@oppenheimer/api-client`: `BotGoalWaitingResponseDto`, and `waiting` on
  `BotGoalResponseDto`.
- `@oppenheimer/shared`: `BotGoal.waiting`.
- `@oppenheimer/web`: the goal banner draws a clock and "waiting for Gmail
  until 10:02" in place of the count while the goal waits.
- `@oppenheimer/translations`: `bots.chat.goal.waiting`.
