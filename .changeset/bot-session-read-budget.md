---
"@oppenheimer/api": patch
---

Bots: a per-turn budget on how much a turn reads off its sessions, so a broad turn (a recap over a day's work) can no longer overflow the bot's own context. `read_session` and `read_session_transcript` now share one budget counted in the characters they return; once a turn has read about 300,000 of them it refuses further reads with a note to answer from what it has or read a narrower slice. Each page was already capped, but a turn that calls the two across dozens of large sessions piled the pages into context faster than autocompaction could shed them, until the provider refused the whole turn ("change the message or the model") and the work was lost. The budget spends a read to save the turn.
