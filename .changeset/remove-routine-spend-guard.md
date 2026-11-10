---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/web": minor
"@oppenheimer/translations": minor
---

The spend guard on a bot's routines is removed (`26-bot-routines.md` §6,
"Removed 2026-11-10"): routines run on their schedule until their owner
pauses them, whether or not anyone opens the bot's chat. The run budget, the
overlap guard and quiet turns still bound their cost.

- `@oppenheimer/api`: a routine's run is no longer skipped or paused as
  `unattended`; `POST /v1/bots/:id/seen`, `bot.routineSpendGuard` and the
  workspace's `unattendedReports` and `unattendedAwaySeconds` automation
  settings are gone, and so is the Inbox line. Migration
  `RemoveRoutineSpendGuard` resumes every routine paused as `unattended` (its
  schedule triggers fire on the next tick, then keep their slots) and drops
  `bot."ownerSeenAt"`, `bot."routineSpendGuard"` and the two settings columns.
- `@oppenheimer/shared`: `unattended` leaves `AUTOMATION_PAUSED_REASONS`
  (it stays in `AUTOMATION_SKIP_REASONS` for the runs that recorded it);
  `updateAutomationSettingsSchema` loses `unattendedReports` and
  `unattendedAwaySeconds`, `updateBotSchema` loses `routineSpendGuard`.
- `@oppenheimer/api-client`: `markBotSeen` is gone.
- `@oppenheimer/frontend-consumer`: `bots.markSeen`, `useMarkBotSeen` and
  `BotEntity.routineSpendGuard` are gone.
- `@oppenheimer/web`: the bot's chat no longer marks the owner seen, and the
  Routines tab loses its "Pause while you're away" switch.
- `@oppenheimer/translations`: `automations.pausedReason.unattended`,
  `bots.settings.routines.guard*` and `bots.routineGuard.notice` are gone.
