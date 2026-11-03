---
'@oppenheimer/api': minor
'@oppenheimer/shared': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/frontend-web': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': patch
'@oppenheimer/docs': patch
---

Live dictation: the words show in the field while they are spoken.
`POST /v1/voice/live` mints a one-minute OpenAI realtime transcription
session on the deployment's key (`VOICE_LIVE_API_KEY`, or `VOICE_STT_*`
pointed at OpenAI), and the console streams the recording to it; the
recording's transcription still replaces the live words when it stops, and
the live words stay when that fails. `GET /v1/voice/status` answers `live`.
`VOICE_008` refuses a live session on a deployment with no key. The kit's
`dictateInto` and `dictateIntoField` replace the live words in place
(`DictatedText`), and `VoiceInput` takes `live`.
