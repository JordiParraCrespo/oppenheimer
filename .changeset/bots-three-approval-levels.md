---
'@oppenheimer/api': minor
'@oppenheimer/web': minor
'@oppenheimer/shared': minor
---

Bots have the sessions' three approval levels. Ask for approval is what Approve for me was, and existing bots move to it unchanged. Approve for me is now an auto mode: a reviewer on the bot's own model reads each call that would ask, against the owner's own messages and instructions, never the bot's text or what its tools read. It lets what the owner asked for run, leaves the rest on the card, and asks when the review fails. Full access skips every card: the owner's own Ask, an ask rule and sending mail still wait for a yes.
