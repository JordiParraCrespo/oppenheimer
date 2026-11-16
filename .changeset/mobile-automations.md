---
"@oppenheimer/mobile": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-web": patch
"@oppenheimer/web": patch
"@oppenheimer/translations": minor
---

The phone's Automations tab, as `Mobile.dc.html` draws it.

- `@oppenheimer/mobile`:
  - **The list:** every automation on one card, with its trigger in words, how its last run went, and the system's switch that pauses it.
  - **An automation's page:** Active and its next run (or why it is paused), the trigger, the instructions, where it runs, and its recent runs. Run now sits in glass at the foot. The system's ··· menu has Run now, Pause or Resume, Duplicate, and Delete behind the system's alert.
- `@oppenheimer/frontend-core`: the trigger wording (`triggerListText`, `scheduleText`, …) and the date helpers it rests on (`dateFormatter`, `viewerTimeZone`, `wallClock`, `weekdayDate`, `clock`, `dayOffset`) move down from the web kit, so both platforms word a trigger the same way.
- `@oppenheimer/frontend-web`: re-exports them from the kernel. The console's imports are unchanged.
- `@oppenheimer/web`: `clock` and `dayOffset` now come from the kit, not the automations feature's own `lib/time.ts`. Nothing the console shows changes.
- `@oppenheimer/translations`: `automations.mobile.*`; `common.comingToMobile.automations` is gone.
