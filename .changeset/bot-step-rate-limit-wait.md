---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A bot's call that a system's rate limit stopped is drawn as a wait, not a
failure.

- `@oppenheimer/api`: a tool step keeps the limit its call ended on
  (`rateLimit: { system, resetAt }` on the stored step and on
  `BotToolStepResponseDto`); null when none stopped it.
- `@oppenheimer/api-client`: `BotToolStepRateLimitResponseDto`, and
  `rateLimit` on `BotToolStepResponseDto`.
- `@oppenheimer/frontend-consumer`: `BotToolStep.rateLimit`, with `resetAt`
  as a `Date`.
- `@oppenheimer/web`: the chat's trace draws a limited step with a clock and
  "Gmail limit · until 10:02" in the line's colour instead of the red
  "failed", and a group of calls does not count it as failed; an exported
  chat marks it the same way.
- `@oppenheimer/translations`: `bots.chat.activity.stepLimited`.
