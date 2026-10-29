---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/backend-agents": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
---

Bots: what Grok Bot's harness does that ours did not (`research/lessons-from-grok-bot.md` §9, rows 1–5).

- A long tool answer keeps its end as well as its start, and says how much of the middle it cut.
- A turn is told how full its context was when the last one ended.
- A reply commits to something, and asking again for work under way reports where it stands.
- A failed turn records what kind of failure it was (`bot_turn.failure`); the chat says whether sending it again can help, offers Retry only when it can, and points a refused key at Model providers.
- `search_chat` searches a bot's own past messages, including what only its summary holds.
- The live line says when the turn waits on a provider that refused a call, and an ended turn says how long it worked.
