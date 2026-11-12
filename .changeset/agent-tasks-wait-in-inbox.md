---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A task an agent made waits in Plan's Inbox until its person takes it up
(`product/versions/mvp/29-inbox.md`, "Tasks an agent made").

- `@oppenheimer/api`: `task` gains `origin` (`person` | `agent`) and
  `triagedAt` (migration `AddTaskOriginAndTriage`). A task made by a bot or on
  an API token or OAuth grant is the agent's and waits; the person (a browser
  session) takes it up by giving it a TODO day, starting or linking a session,
  or `POST /v1/tasks/:id/triage` (`tasks:write`). Task responses carry both
  fields. The bots' plan tools call the first column "Not started".
- `@oppenheimer/shared`: `TASK_ORIGINS` and `TaskOrigin`; the bundled guide.
- `@oppenheimer/api-client`: regenerated (`triageTask`, the two fields).
- `@oppenheimer/frontend-consumer`: `TaskEntity` gains `origin`, `triagedAt`
  and `awaitsTriage`; the Inbox reads the board's tasks and lists a waiting
  one as a `task` item; `useTriageTask`.
- `@oppenheimer/web`: the Inbox's task card (Put on today, Start session,
  Dismiss, Open task) and a Tasks type; Mark as done and Delete on a task
  also dismiss it.
- `@oppenheimer/translations`: `inbox.type.task`, `inbox.from.task` and
  `inbox.task.*`.
