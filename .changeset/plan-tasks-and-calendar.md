---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/api-client": minor
"@oppenheimer/shared": minor
"@oppenheimer/translations": minor
---

Plan: a task board, goals and a calendar, the console rail's third item
(`product/versions/mvp/17-plan.md`).

- `@oppenheimer/api`: the `tasks` module (tasks, goals, the board's order,
  starting or linking a session, the attach rule) and the `calendar` module
  (personal events, read-only Google Calendar through a port, the sealed
  refresh token under `CALENDAR_TOKEN_KEY`), with the `google_calendar`
  capability, two migrations and the `Task` and `Calendar` rules on `owner`.
- `@oppenheimer/web`: `/plan` (the board and its dialogs), `/plan/calendar`
  (the month and its layers) and `/plan/calendar/google` (Google's return),
  the Plan rail item, and "Back to task" in a session's status bar.
- `@oppenheimer/frontend-consumer`: the `tasks` and `calendar` modules and
  their query hooks; `toCreateSessionRequest` is shared by both start paths.
- `@oppenheimer/frontend-web`: `DateField`, `TimeField` and calendar-day
  helpers in the `i18n` concern.
- `@oppenheimer/api-client`: regenerated for the new routes.
- `@oppenheimer/shared`: the task, goal and calendar schemas, the `tasks` and
  `calendar` scopes and the `Task` and `Calendar` subjects.
- `@oppenheimer/translations`: the `tasks` and `calendar` namespaces,
  `nav.plan`, the date and time field copy and the new toasts.
