---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/web-showcase": patch
"@oppenheimer/shared": patch
---

TODO knows about agents (`product/versions/mvp/20-plan-calendar.md` §6,
"Changed on 2026-11-12").

- `@oppenheimer/web`: a task on TODO that an agent is working on (a session
  running or queued, none waiting on the person) moves to a "With agents"
  section under the list, with its session's chip; the others with sessions
  stay on the list marked waiting on you, failed, ready to review (the In
  review column only) or agent stopped. The header's "left" and the
  sidebar's TODO count leave out what is with agents. Each open row has a
  Move button (Tomorrow, or a day picked on a month) that sets its TODO
  day, except a task its deadline holds on the day shown.
- `@oppenheimer/design-system-web`: `DatePicker` takes the caller's own
  trigger as `children` (an `IconButton` on a row); the month and the quick
  picks are the same.
- `@oppenheimer/translations`: the board's first column reads "Not started"
  ("Sin empezar"), the dialog's day field "TODO day" ("Día en TODO"), and
  "on TODO since {{date}}"; `tasks.todo` gains `withAgents`, `mark.*`,
  `move`, `moveTitle` and `moveFailed`.
- `@oppenheimer/web-showcase`: the board's first column is Not started, and
  the DatePicker spec shows an icon trigger.
- `@oppenheimer/shared`: the bots' bundled guide follows the user guide's
  TODO page.
