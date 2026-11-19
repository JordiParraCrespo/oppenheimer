---
"@oppenheimer/mobile": minor
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/frontend-web": patch
"@oppenheimer/web": patch
"@oppenheimer/translations": minor
---

The phone's Automations tab, as `Mobile.dc.html` draws it.

- `@oppenheimer/mobile`:
  - **The list:** every automation on one card, with its trigger in words, how its last run went, and the system's switch that pauses it.
  - **An automation's page:** Active and its next run (or why it is paused), the trigger, the instructions, where it runs, and its recent runs. Run now sits in glass at the foot. The system's ··· menu has Run now, Pause or Resume, Duplicate, and Delete behind the system's alert.
- `@oppenheimer/frontend-consumer`: an automation's words move here, beside the automations module, so both apps say them the same way: its trigger (`triggerListText`, `scheduleText`, `daysText`, `eventLabel`, …, from the web kit) and its status (`runState`, `nextRunText`, `nextInstantText`, `pausedReasonText`, `automationAgentText`, from the console's automations feature).
- `@oppenheimer/frontend-core`: the date helpers that wording rests on (`dateFormatter`, `viewerTimeZone`, `wallClock`, `weekdayDate`, `clock`, `dayOffset`) move down from the web kit, as product-free `Intl` formatting.
- `@oppenheimer/frontend-web`: re-exports the date helpers the console reads from the kernel; the trigger wording is no longer the kit's.
- `@oppenheimer/web`: imports the trigger and status wording from the product package, and `clock` and `dayOffset` from the kit rather than the automations feature's own `lib/time.ts`. Nothing the console shows changes.
- `@oppenheimer/translations`: `automations.mobile.*`; `common.comingToMobile.automations` is gone.
