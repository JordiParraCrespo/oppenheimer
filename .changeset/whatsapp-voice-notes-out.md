---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/translations': minor
'@oppenheimer/runner': minor
---

Bots send WhatsApp voice notes: `send_whatsapp_voice_note` speaks a short text on the deployment's text-to-speech server (`VOICE_TTS_*`, optional) and the runner sends it as a playable push-to-talk note over the new `whatsapp.send.voice` frame (capability `whatsapp.voice.send`). It asks like a text, with the exact words and the chat on the card, and spends the same send budget.
