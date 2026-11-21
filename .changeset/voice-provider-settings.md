---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/api-client": minor
"@oppenheimer/translations": minor
"@oppenheimer/docs": patch
---

Voice is configured with the keys. Settings → Model providers lists Groq and
ElevenLabs (voice only) beside the bot providers, and a Voice section picks,
for the workspace, the speech-to-text provider and model, the voice-note
provider, model and voice (OpenAI's set, or any ElevenLabs voice id), and the
transcript polish's provider and model, or none. `GET`/`PUT /v1/voice/settings`
hold the choices in `voice_settings`; dictation, WhatsApp voice notes heard and
spoken, and the polish try the chosen provider first and the rest after it.
Speech synthesis becomes a provider list like transcription, with the
deployment's `VOICE_TTS_*` server last.
