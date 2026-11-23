---
"@oppenheimer/runner": patch
---

A WhatsApp voice note a bot sends carries its waveform: 64 bars drawn
from the size of each Opus packet. A push-to-talk note without one shows
its length but plays no sound on the phones (whatsmeow#517). Audio that is
silent from start to end is refused before the upload (`WA_008`), where it
used to go out as a successful note of the right length that played
nothing.
