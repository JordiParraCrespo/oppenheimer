---
'@oppenheimer/api': patch
---

An approved call's lines keep their stage when the chat is read back. The
stored-message read dropped `stage`, so the line over the bot's report read
"You approved: …" a second time instead of "Done: …", the chat never drew
the call as running, and the turn a yes opens was not run as the short
"on it" turn.
