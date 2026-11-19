---
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
---

Bots hear WhatsApp voice notes. The runner keeps each voice note's media key
and path (never the audio) for 48 hours, reports how long it runs
(`voiceSeconds`), and hands the audio over when asked (`whatsapp.media.get`,
answered by `whatsapp.media` or `WA_005`–`WA_007`), behind the new
`whatsapp.voice` capability. The owner's voice note queues their bot's turn
at once, in order; when the turn starts, the API fetches the note, decodes
the Ogg/Opus to WAV in process and hears it through the workspace's
dictation providers, so the turn opens with what the note says, or why it
could not be heard. The transcript is kept on
the message, and the bot's WhatsApp reads show it.
