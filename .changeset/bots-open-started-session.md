---
"@oppenheimer/shared": minor
"@oppenheimer/backend-agents": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/web-showcase": patch
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Bots: a session a bot starts is one click away in its chat.

- `@oppenheimer/backend-agents`: a tool's result may carry `data`, what the
  call made, which the model never reads; `tool.finished` hands it back. The
  Claude engine matches it to its call by Claude Code's `claudecode/toolUseId`,
  the OpenAI engine by the SDK's call id.
- `@oppenheimer/shared`: `sessionId` on `BotMessageEvent`.
- `@oppenheimer/api`: `start_session` says which session it started as data,
  not only in words. The tool step keeps it (`sessionId` on a step), and an
  approved call keeps it on the approval (`bot_approval."sessionId"`, migration
  `AddBotApprovalSession`) and on the event that reports the yes.
- `@oppenheimer/api-client`: `sessionId` on `BotToolStepResponseDto` and
  `BotMessageEventResponseDto`.
- `@oppenheimer/frontend-consumer`: `sessionId` on `BotToolStep`.
- `@oppenheimer/design-system-web`: an `action` slot on `TraceStep` (at the
  end of the line, outside the fold's trigger) and on `TranscriptDivider`
  (after the label).
- `@oppenheimer/web-showcase`: both slots in the chat demos.
- `@oppenheimer/web`: a small Open session button, opening the session in a
  new tab, on the step of the call that started it and on the approval line.
- `@oppenheimer/translations`: `bots.chat.openSession`.
