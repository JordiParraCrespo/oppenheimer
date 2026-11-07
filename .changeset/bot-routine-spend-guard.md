---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

A bot's routines stop while its owner is away and start again when they
are back (`26-bot-routines.md` §6, the spend guard), the way an agent that
watches a pull request stops when nobody writes and comes back when written
to.

- `@oppenheimer/api`: after 3 routine reports the owner has not seen (quiet
  turns do not count), or 72 h since they were last in the bot's chat, a
  routine's run is skipped as `unattended`, every live routine of the bot
  pauses with `pausedReason = 'unattended'`, and one Inbox line says so.
  `bot."ownerSeenAt"` records the owner in the chat, at most once a minute,
  from the new `POST /v1/bots/:id/seen` and from sending a message or
  deciding a card; it resumes the routines paused as `unattended`, and only
  those. Run now passes the guard. Migration `AddRoutineSpendGuard`.
- `@oppenheimer/shared`: `unattended` joins `AUTOMATION_PAUSED_REASONS` and
  `AUTOMATION_SKIP_REASONS`.
- `@oppenheimer/api-client`: `markBotSeen`.
- `@oppenheimer/frontend-consumer`: `bots.markSeen` and `useMarkBotSeen`.
- `@oppenheimer/web`: a bot's chat marks the owner seen when it opens and
  when its tab comes back into view; the chat says why a routine paused
  while the owner was away.
- `@oppenheimer/translations`: `automations.pausedReason.unattended`,
  `automations.skipReason.unattended`, `bots.chat.routineReason.unattended`.
