---
'@oppenheimer/shared': minor
'@oppenheimer/api': minor
'@oppenheimer/api-client': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/web': minor
'@oppenheimer/translations': minor
---

A bot can follow a project's tasks, or one milestone's. `watch_project
{ project_id, events?, purpose? }` and `watch_milestone { milestone_id,
events?, purpose? }` subscribe it, and their `unwatch_` pairs stop it;
`list_watches` lists them beside sessions and pull requests. Each change
Plan logs on a task there that the bot named in `events` wakes it with one
queued turn: by default a task added, moved column, done, reopened, blocked,
unblocked or deleted (`BOT_TASK_WAKE_DEFAULT`), and on request a new due
date, a move to another project or milestone, or a session attached. The
wake names the task, its title (fenced), the columns and whether the person
made it, never its notes. A change the bot made itself never wakes it, and
there is no wake limit. A milestone deleted deletes its subscriptions; one
whose owner can no longer read the project or milestone ends at its next
wake.

A task now raises `TaskActivityLoggedDomainEvent` for each change its write
logs to `plan_event`, in the same transaction. `bot_subscription` gains the
`project` and `milestone` kinds and a `taskEvents` list, held to the kind by
`CHK_bot_subscription_subject`. The chat draws the wake as one line, "“Ship
the docs” moved from Not started to In progress", from a new `task` event
kind.
