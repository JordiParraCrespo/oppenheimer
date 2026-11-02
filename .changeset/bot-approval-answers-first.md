---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot answers a yes before it does the work. Approving a Needs input card
now queues, with the decision, a short turn where the bot says it is on it
in its own voice ("On it, archiving those 25 now."), while the approved call
runs; that turn's tools refuse to run and it has two round trips. The chat
holds the call as a live line with its clock ("Running: …") under that
sentence until the report lands, and the report's line reads "Done: …" (or
"It failed: …") instead of a second "You approved". An approval event says
which of the two lines it is (`stage`: `started` or `finished`); an "on it"
turn whose call already ran ends without a word.
