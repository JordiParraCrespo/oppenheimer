---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot can set itself a goal. `set_goal` and `end_goal` are new tools, and
the goal is stored in a new `bot_goal` table, one per bot. When a turn ends
with the goal open, a `goal` turn is queued to continue it (at most 5, or up
to 10 if the bot asks). The continuation runs as the owner with the setting
turn's reach, and is keyed so it is queued once. A continuation cannot set
a new goal.

The goal ends with a line in the chat when the owner stops it
(`DELETE /v1/bots/:id/goal`, which also cancels a continuation still
waiting), when its continuations run out, or when a turn of it fails or is
stopped. `GET /v1/bots/:id/goal` reads it. The console shows it above the
composer with Stop (`useBotGoal`, `useClearBotGoal`), and draws its lines
as goal events.
