---
"@oppenheimer/api": minor
---

Bots keep two memories, named in their prompt: their own and the general memory about the person. `remember` takes `memory: "yours" | "general"` instead of `about`, and one rule picks between them: general only for what a bot with a different job would need, so a bot's projects, folders and settings no longer reach every other bot.
