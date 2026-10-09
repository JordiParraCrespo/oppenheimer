---
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
---

Switching between sessions no longer reconnects in front of a blank pane. The console keeps the last few terminals attached for five minutes after the reader leaves them, so going back shows them as they are without dialling; a terminal that was closed leaves its last frame, which the next one draws while it dials; and resting the pointer on a session's row mints its attach ticket ahead of the click (`SessionsService.primeAttachTicket`, `usePrimeSessionStream`). Signing out closes every kept terminal and forgets every frame.
