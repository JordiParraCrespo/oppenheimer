---
'@oppenheimer/api': patch
---

A bot deleted while one of its turns runs no longer reports that turn as a
storage failure. Deleting the bot deletes the turn with it, so the turn's
next message was refused by Postgres (`FK_bot_message_turn`) and the turn
was reported to Sentry as ours (`TurnStorageError`). The turn now stops
there, unreported; any other write Postgres refuses is still `storage`.
