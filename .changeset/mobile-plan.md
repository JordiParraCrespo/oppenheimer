---
"@oppenheimer/mobile": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-web": patch
"@oppenheimer/web": patch
"@oppenheimer/translations": minor
---

The phone's Plan tab: your tasks, as the console's board lays them out.

- `@oppenheimer/mobile`:
  - **The tab:** the four columns in order on one list. Done keeps the past week, and the rest is a tap away. The project is picked in the system's picker, the counts sit under the title, and Add task is at the foot of Not started. Each row has its done check, where it is filed, its due date, and its session line, which opens the session.
  - **A task's page:** its notes, its column (the system's picker), project, milestone, due date, and its sessions. Delete sits behind the system's alert.
- `@oppenheimer/frontend-consumer`: these move here from the console's tasks feature, so both apps read and word a board the same way:
  - the board's columns and counts (`boardColumnsOf`, `boardCounts`, `columnOf`, `doneCutoffOf`, `filingOf`, …);
  - a task's card in words (`cardView`, `dueDayLabel`, `TaskDueTone`);
  - its session line (`sessionLineOf`, `taskSessionsOf`, `sessionStateOf`, `mostUrgent`).
- `@oppenheimer/frontend-core`: `todayIn`, `daysBetween` and `nearDay`, calendar-day arithmetic in no timezone, move down from the web kit.
- `@oppenheimer/frontend-web`: re-exports `todayIn`; `daysBetween` and `nearDay` are no longer the kit's.
- `@oppenheimer/web`: imports the board, card and session-line helpers from the product package. Nothing the console shows changes.
- `@oppenheimer/translations`: `tasks.mobile.*`; `common.comingToMobile.plan` is gone.
