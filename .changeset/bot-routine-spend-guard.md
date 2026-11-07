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
  those. Run now passes the guard; a pause delivered after the owner came
  back stops nothing more; the Inbox line is in the owner's language. The
  thresholds are the workspace's `unattendedReports` and
  `unattendedAwaySeconds` automation settings, and `bot.routineSpendGuard`
  (on by default, `PATCH /v1/bots/:id`) turns the guard off for one bot.
  Migration `AddRoutineSpendGuard`.
- `@oppenheimer/shared`: `unattended` joins `AUTOMATION_PAUSED_REASONS` and
  `AUTOMATION_SKIP_REASONS`; `updateAutomationSettingsSchema` gains
  `unattendedReports` and `unattendedAwaySeconds`; `updateBotSchema` gains
  `routineSpendGuard`.
- `@oppenheimer/api-client`: `markBotSeen`.
- `@oppenheimer/frontend-consumer`: `bots.markSeen`, `useMarkBotSeen`, and
  `BotEntity.routineSpendGuard`.
- `@oppenheimer/web`: a bot's chat marks the owner seen when it opens, when
  its tab comes back into view and every five minutes in view; the chat
  says why a routine paused while the owner was away; the Routines tab has
  a "Pause while you're away" switch.
- `@oppenheimer/translations`: `automations.pausedReason.unattended`,
  `automations.skipReason.unattended`, `bots.chat.routineReason.unattended`,
  `bots.settings.routines.guard*` and `bots.routineGuard.notice`.
