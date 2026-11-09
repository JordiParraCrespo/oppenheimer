---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

Settings → Memory, at the account: what all your bots know about you, in one
place, the way Claude's memory works. *About you* is a text you write
(`person_memory`, up to 4,000 characters), in the system prompt of every bot
you made in the workspace and never changed by a bot. Under it is every fact
about you that a bot of yours learned, naming the bot that keeps it; edit,
move and forget act on that bot. `GET /v1/bot-memory/person` reads both and
`PUT /v1/bot-memory/person/about` writes the text.
