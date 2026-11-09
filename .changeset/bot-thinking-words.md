---
"@oppenheimer/web": patch
"@oppenheimer/translations": patch
---

A bot's live line thinks in a word picked for the turn ("Pondering…",
"Percolating…", "Tinkering…") instead of always "Thinking", the same word for
the whole turn.

- `@oppenheimer/translations`: `bots.chat.turn.musing.*` in English and
  Spanish, in place of `bots.chat.turn.thinking`.
