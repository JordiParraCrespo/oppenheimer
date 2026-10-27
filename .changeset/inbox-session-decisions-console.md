---
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": patch
---

Answer a session's question or permission from its Inbox card (the console
half of the Inbox's slice 4, `29-inbox.md`).

- `@oppenheimer/frontend-consumer`: `decision` on `SessionEntity`,
  `answerDecision` on the sessions repository and service, and
  `useAnswerSessionDecision`, which puts the answered row in the lists and
  reads the session again on `SESSIONS_032`. A session waiting on a decision
  is the Inbox item `session:<id>:<decisionId>`; `sessionItemKey` is exported.
- `@oppenheimer/design-system-web`: `InboxCardChoices`, `InboxQuestions`,
  `InboxQuestion`, `InboxQuestionOptions` and `InboxQuestionOption`, with
  their showcase demos.
- `@oppenheimer/web`: the Inbox's session card answers a permission dialog
  (an option per button, in the dialog's order) and an agent's questions
  (numbered, pills, an own answer each, Send answers), keeping a refusal on
  the card.
- `@oppenheimer/translations`: the cards' copy and the "Answered" log line.
