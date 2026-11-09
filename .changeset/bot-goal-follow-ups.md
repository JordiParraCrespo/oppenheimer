---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
'@oppenheimer/design-system-web': minor
---

Follow-ups to unbounded bot turns and goals:

- A goal whose turn a provider refused for a limit with a known end (a rate
  limit's reset, a spent plan window's) waits until then and goes on by
  itself; it pauses for Resume only when no time is known.
- The job that decides a goal turn's end is idempotent: run twice, it counts
  the turn once and queues one continuation.
- Turns nobody waits on (a goal's, a loop's, a routine's, a wake's) run on a
  new `bot-background-turns` queue with its own worker, so a long one never
  holds a slot a person's message waits on.
- A turn that compacted mid-turn shows one quiet trace line among its calls,
  with the tokens before and after (a new `compaction` message event).
- The live line of a turn at work draws a thinking orb (`thinking-orbs`, MIT)
  whose animation follows what the bot is doing: breathing while it waits,
  searching while it looks things up, connecting while subagents work,
  solving while a tool runs, composing while it writes. `TraceLive` takes a
  `glyph`, the agent glyph when none is given, and a bot's clock reads "6s",
  "1m 5s" instead of "00:06".
