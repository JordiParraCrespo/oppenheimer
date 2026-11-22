---
"@oppenheimer/api": patch
---

A bot's voice note is decoded before it goes: Ogg/Opus that decodes to
silence (its pages say nine seconds, its samples say nothing) is that
text-to-speech provider failing (`VOICE_009`), and the next provider is
tried, instead of a note that shows its length and plays nothing.
