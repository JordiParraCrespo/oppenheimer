---
"@oppenheimer/design-system-web": patch
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": patch
"@oppenheimer/web": minor
"@oppenheimer/runner": minor
---

A session's chat queues what is written while the agent works and shows how full its context is. A message sent mid-turn waits on the composer (`SessionChat.post`), to be sent now, edited or dropped, and goes on its own when the turn ends, one at a time. The runner now keeps each answer's token counts (`message.usage`) in the chat it sends, so `ChatTurn.contextTokens` carries what the context held, and the composer shows it beside the model as `ComposerContextMeter`, which compacts on a click. The composer's field is no longer remounted when something appears on top of it, so focus stays put.
