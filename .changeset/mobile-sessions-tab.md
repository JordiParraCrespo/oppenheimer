---
"@oppenheimer/mobile": minor
"@oppenheimer/frontend-mobile": minor
"@oppenheimer/design-system-mobile": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": patch
"@oppenheimer/translations": minor
---

The phone's Sessions tab lists your sessions, as `Mobile.dc.html` draws them.

- `@oppenheimer/mobile`: search, the All / Needs input / Running / Failed
  chips with their counts, then the sessions waiting on you (what each asks
  under its name), then the rest by project; each row the agent, its state's
  dot, where it runs and its age.
- `@oppenheimer/frontend-consumer`: `groupByProject`, `matchesQuery` and
  `stateWordFor` move here from the console's sessions feature, so both apps
  group, search and word a session the same way.
- `@oppenheimer/web`: imports those three from the product package; nothing
  the console shows changes.
- `@oppenheimer/frontend-mobile`: `formatAge`, the console's compact ages.
- `@oppenheimer/design-system-mobile`: `useNow`.
- `@oppenheimer/translations`: `sessions.sidebar.noSessionsPhone`;
  `common.comingToMobile.sessions` is gone.
