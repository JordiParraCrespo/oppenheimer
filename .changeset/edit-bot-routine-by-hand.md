---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A bot's routine can be edited by hand from its Routines tab
(`product/design/bots/26-bot-routines.md` §7, changed 2026-11-21).

- `@oppenheimer/api`: `PATCH /v1/bots/:id/routines/:routineId` takes `name`
  and `prompt` beside `enabled` (any of them, at least one). A name or prompt
  change takes the editing credential's scopes, as `update_routine` does.
- `@oppenheimer/shared`: `botRoutineTaskSchema`, `BOT_ROUTINE_NAME_MAX`,
  `BOT_ROUTINE_PROMPT_MAX`; `updateBotRoutineSchema` widened; the bundled guide.
- `@oppenheimer/api-client`: regenerated.
- `@oppenheimer/frontend-consumer`: `useUpdateBotRoutine`.
- `@oppenheimer/web`: the card's pencil opens Edit routine (name, prompt, and
  when it runs read-only with Ask in chat) instead of going to the chat.
- `@oppenheimer/translations`: `bots.settings.routines.dialog.*`; `edit` reads
  "Edit routine".
