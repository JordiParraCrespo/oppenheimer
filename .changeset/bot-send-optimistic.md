---
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': patch
---

Sending to a bot is optimistic: the message, and its turn queued, are drawn
in the chat (or among the waiting messages, behind a running turn) the
moment you send, and the composer empties at once. A send the API refuses
comes back out of the chat, its words and images back in the composer.
`useSendBotMessage` takes the message's `attachments` rather than their ids.
