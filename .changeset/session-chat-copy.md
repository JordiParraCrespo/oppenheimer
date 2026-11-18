---
"@oppenheimer/web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
---

A session's chat copies what was said, as Claude Code on the web does: the
prompt from under its card, on hover, beside its time, and a settled turn's
answer (its last words, every reply after its last piece of work) from a
trail beneath it.

- `@oppenheimer/frontend-web`: `CopyTextButton` moves here from the bots
  feature, so the session chat and a bot's chat share it.
- `@oppenheimer/translations`: `sessions.chat` gains `copyMessage` and
  `copyReply`.
