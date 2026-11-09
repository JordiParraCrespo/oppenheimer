---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
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
- A turn that compacted mid-turn shows a line in the chat with the tokens
  before and after (a new `compaction` message event).
