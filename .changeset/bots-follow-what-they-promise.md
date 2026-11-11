---
"@oppenheimer/api": minor
---

Bots follow every session task they set going or choose to watch: `answer_session` follows the task it unblocked, a watched running task gets the hand-off's regular looks, `watch_session` takes `check_in_minutes` for one more look at a time the bot names, and the prompt tells a bot never to promise to come back to something nothing will wake it for.

A session read by id or in a list now carries its latest turn, so a bot following a session is woken when its task ends and its looks see the task: until now every such wake found no task and was skipped.
