---
'@oppenheimer/api': minor
'@oppenheimer/shared': patch
---

A bot answering a WhatsApp group or a contact's chat can reply with a voice note where the owner lets `send_whatsapp_voice_note` run in that chat without asking and the workspace can speak. Before, such a turn had no tools, so its reply was always text, even when the bot's instructions asked for voice there. The turn is told it may mark its reply `[voice]`. Delivery checks the permission again, speaks the reply, and sends it as the only message, falling back to text when the reply is better read, too long, can't be spoken, or the host refused it.
