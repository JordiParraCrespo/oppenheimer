---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Bots: a session a bot starts is one click away in its chat.

- `@oppenheimer/shared`: `startedSessionId`, which reads the session id off
  `start_session`'s answer, and `sessionId` on `BotMessageEvent`.
- `@oppenheimer/api`: an approved `start_session` event carries the session it
  started (`event.sessionId`).
- `@oppenheimer/api-client`: `sessionId` on `BotMessageEventResponseDto`.
- `@oppenheimer/web`: a small Open session button, opening the session in a
  new tab, under the approval line that started it and under the trace of a
  `start_session` that ran without asking.
- `@oppenheimer/translations`: `bots.chat.openSession`.
