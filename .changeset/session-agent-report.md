---
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A session carries the agent's own word on what it is doing, when it gave
one through OSC 7501 (the runner's `pty` wrapper keeps it).

- `@oppenheimer/shared`: `sessionAgentReportSchema` (`state`, `kind`,
  `progress`, `message`, `title`) and its state and kind lists.
- `@oppenheimer/api`: the fold keeps the `program` of the last
  `agent.observed` as `work_session.agentReport` (migration
  `FoldSessionAgentReport`), clears it on an observation read off the
  screen and when the session stops, fails, closes or starts again, and
  answers it as `agentReport` on every session.
- `@oppenheimer/api-client`: `SessionAgentReportResponseDto`.
- `@oppenheimer/frontend-consumer`: `SessionEntity.agentReport`.
- `@oppenheimer/web`: the session bar follows the state word with why the
  agent waits ("Needs your permission") and its own message.
- `@oppenheimer/translations`: `sessions.session.agentReport`.
