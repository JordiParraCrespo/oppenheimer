---
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/shared": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A bot's chat reaches its whole history: scrolled to the top, the console reads the page of messages older than what it shows and lays it above, keeping your place, until the chat's first message. Until now the chat only ever showed its newest 100 messages, so a bot whose routine writes every half hour hid the conversation behind it. `GET /bots/:id/conversation` takes `before` (a message id, the oldest the reader holds) for the page older than it, and answers `hasOlder`.
