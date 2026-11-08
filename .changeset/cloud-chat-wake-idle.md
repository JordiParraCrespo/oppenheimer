---
"@oppenheimer/api": minor
"@oppenheimer/shared": minor
"@oppenheimer/runner": minor
"@oppenheimer/docs": patch
---

A reply typed in a Claude Code cloud session's chat wakes the session when it is idle.

- When the session's Stop hook stops waiting with nothing to take, the API marks the session idle (`session_cloud_idle`). A reply typed after that is sent from the host that started the session, with the account's own `claude -p <text> --cloud <id>`, instead of waiting for a turn that never comes.
- The link carries it as `session.cloud.prompt`, answered with `session.cloud.prompted` or `command.failed`, sent only to a runner whose hello names `session.cloud.prompt`.
- A reply reaches the agent once: two replies at once wake the session once, a hook that takes a reply first wins, and a host that could not send it (offline, too old, not signed in to claude.ai, `SESS_019`, or refused, the new `SESS_020`) leaves it waiting for the next turn.
