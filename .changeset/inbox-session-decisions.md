---
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/api": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/translations": minor
---

Answer a session's question or permission from anywhere but its terminal
(the server half of the Inbox's slice 4, `28-inbox.md`).

- `@oppenheimer/shared`: `SessionDecision` (a `question` from
  `AskUserQuestion`, or a `permission` dialog), the `agent.decision` payload,
  `answerSessionDecisionSchema`, and `@oppenheimer/shared/sessions` with
  `questionKeys`, `permissionKeys` and `QUESTION_KEY_GAP_MS`, moved from the
  console so the API types the same keys. The Go twin of the decision is
  generated (`emit-session-decision.cjs`).
- `@oppenheimer/runner`: reports `agent.decision` when what a blocked agent
  waits on appears, changes or clears: the transcript's open
  `AskUserQuestion`, else Claude Code's permission dialog read off the
  screen.
- `@oppenheimer/api`: folds it as `pendingDecision` (a new `jsonb` column),
  answers it on sessions as `decision`, and adds
  `POST /v1/sessions/:id/decision`, which types the answer into window 0 as
  `session.input` and records `decision.answered`. New codes `SESSIONS_032`
  (already answered or changed), `SESSIONS_033` (does not fit) and
  `SESSIONS_034` (host offline).
- `@oppenheimer/api-client`: `answerSessionDecision`, and `decision` on
  `SessionResponseDto`.
- `@oppenheimer/frontend-consumer`: the chat view imports `questionKeys`
  from `@oppenheimer/shared/sessions`.
- `@oppenheimer/translations`: messages for `SESSIONS_032`–`SESSIONS_034`.
