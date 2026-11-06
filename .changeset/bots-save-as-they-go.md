---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
---

Bots save what they learn as they go, in Grok Bot's shape (`research/lessons-from-grok-bot.md` §10).

- A bot's save is a dated `log` fact unless it names `profile`, which is kept for standing instructions and who the person is.
- Each turn's prompt carries the newest profile facts (4,000 characters) and the newest log entries (2,000, each under its day), and says how many older facts are left to `recall`.
- "How a turn goes" asks a bot that can `remember` to save what it learned in the turn, without asking; `remember` no longer asks for a `recall` first.
- A bot keeps up to 500 facts. When its own save finds memory full, its oldest log fact makes room; a fact added by hand is still refused (`BOTS_009`).
- A fact the bot saved names the bot as its source, not the person.
