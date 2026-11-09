---
"@oppenheimer/web": minor
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/translations": minor
"@oppenheimer/web-showcase": patch
---

Plan's calendar and tasks follow the 2026-11-08 `Tasks` frame.

- `@oppenheimer/web`: the calendar opens on Day, with Week and Month beside
  it (`?view=`, `?date=`): the hours from 07:00 to 22:00 under an All day
  row, where an event or a task due at a time is dropped on a half hour to
  move there, and an empty half hour opens New event at that time. Plan
  gains To do (`/plan/todo`), one day's tasks with what is overdue, ticked
  and added in place.
- `@oppenheimer/design-system-web`: `AgendaCalendar` (with `agendaSlot` and
  `agendaSlotId`) and `TodoRow`, `TodoRowAdd`, `TodoRowSkeleton`;
  `MonthCalendar` takes `onOpenDay`.
- `@oppenheimer/frontend-web`: `isoWeek`.
- `@oppenheimer/translations`: `calendar.header` gains the views and the
  week eyebrows, `calendar.grid.allDay`; `tasks.nav.todo` and `tasks.todo`.
- `@oppenheimer/web-showcase`: the AgendaCalendar and TodoRow demos.
