---
"@oppenheimer/api": minor
---

On Telegram and WhatsApp, a bot answers first, works, then comes back with the result. In the owner's own chat, what the bot writes before a tool call is sent as the call begins ("On it, checking your sessions"), a message written while it works reaches the running turn at its next tool call so the bot can answer it in a line and carry on, and the turn's end sends only what came after its last call. No runner release is needed.
