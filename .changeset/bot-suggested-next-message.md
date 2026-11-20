---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/shared": minor
---

The bot's composer suggests your next message once the bot has answered, greyed out in the empty box, and Tab writes it in (as Claude Code does). The bot's own model makes the guess (`GET /v1/bots/:id/suggestion`), kept once per message it answers, and its spend shows in `/usage` as suggested replies.
