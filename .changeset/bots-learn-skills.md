---
"@oppenheimer/api": minor
---

Bots save and fix their own skills, from Hermes Agent's learning loop
(`product/versions/mvp/25-bots.md` §4.1, Skills): the prompt says when to
save one unasked, a turn of 8 tool calls with no skill used or saved is
reminded once, and a new `patch_skill` tool replaces one exact passage of a
skill (the bot's own unasked, the person's only when they asked).
