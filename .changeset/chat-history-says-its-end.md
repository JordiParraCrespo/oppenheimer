---
'@oppenheimer/shared': minor
'@oppenheimer/runner': patch
'@oppenheimer/api': patch
'@oppenheimer/frontend-consumer': patch
---

A session chat's history says where it ends. The runner marks each batch of a history `more` until the one that reaches the transcript's end, `end`; the API relays it, and the console holds a first load until it is told, instead of guessing from the batches' size and pace. A chat full of screenshots, whose reads the runner slows making previews, is drawn once, at its end, not once per read on its way down.
