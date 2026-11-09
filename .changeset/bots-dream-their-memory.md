---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
---

Bots dream: an offline pass of the bot's own model tidies the memory it wrote (`25-bots.md` §4.1, "Dreaming"; from Managed Agents' dreams).

- After a turn, once the bot keeps 8 facts of its own and has written 10 since its last dream (at most daily, only while "Learn automatically" is on), a `bot-dreams` job merges duplicates, drops what is stale or contradicted, rewrites each fact as one clear sentence and adds at most five the conversation shows will matter, checked against the conversation summary and the newest messages.
- Only the bot's own facts are rewritten; what the person wrote and what other bots share stay as they are. A merged log fact keeps its day.
- The write is refused when the memory changed since the dream read it, and an answer that keeps too little or would overfill the memory is not used.
- Each dream is a line in the chat. Settings → Memory shows the last one, with **Tidy now** (`POST /bots/:id/memory/dream`) and **Undo** (`POST /bots/:id/memory/dream/undo`, `BOTS_041` when there is nothing to undo), which puts the old facts back and keeps what the bot saved since.
- `/usage` counts a dream's spend as `dream`.
