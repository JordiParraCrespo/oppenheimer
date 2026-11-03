---
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

The `/usage` card is drawn like Claude Code's small usage card
(`product/versions/mvp/25-bots.md` §4.1).

- `@oppenheimer/web`: the command as a bubble, then a 384px card with Copy
  and Close: the plan's 5-hour and weekly windows as bars on a sign-in that
  reports them, this chat's figures in a grid (time active, turns, cache
  hit, tokens, each model's share) and the breakdown of input, output,
  cache read and cache write, with the calls outside its turns named.
- `@oppenheimer/translations`: `bots.chat.usage.*` are labels now
  (`thisChat`, `breakdown`, `active`, `turns`, `cacheHit`, `tokens`,
  `models`, `input`, `output`, `cacheRead`, `cacheWrite`); `since`,
  `summary` and `modelShare` are gone.
