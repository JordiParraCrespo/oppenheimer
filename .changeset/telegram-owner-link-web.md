---
'@oppenheimer/web': patch
'@oppenheimer/translations': patch
---

Telegram's owner link works without the Telegram app: under a link just made, a "No Telegram app?" fold walks through opening the bot's chat on Telegram Web and sending the `/start <code>` message, with Copy, which drops the link's code.
