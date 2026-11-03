---
'@oppenheimer/frontend-consumer': patch
'@oppenheimer/web': patch
---

A long session chat draws its history once, at its end, on a first load.
The runner sends the history in batches of up to 256 entries, and the chat
drew each one as it landed: the 40-turn window ran through the whole
conversation, about 290 turns mounting and fading in on the way to the end,
the view jumping as it went. The chat now holds a first load back
(`ChatState.loading`) until its history has come: a batch shorter than the
runner's full ones, or half a second with none. Until then the chat shows
its frame and composer, not the empty state. A short history draws at once,
and a reconnect's replay keeps its own check.
