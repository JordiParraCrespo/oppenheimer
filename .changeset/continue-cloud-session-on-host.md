---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
---

Continue a Claude Code cloud session on a host. The cloud session's pane
offers *Continue on a host*: pick a host and the console starts a worktree
session there on the cloud session's repository whose agent runs
`claude --teleport <id>`, then opens it. `POST /sessions` takes `teleport`
(a cloud session id, with one checkout and no prompt); the launch keeps it
(`launchTeleport`), so a re-sent create continues the same cloud session and
a restart reopens it with `claude --continue`. The runner names the new
capability `session.teleport`; a host whose runner does not is refused with
`SESSIONS_048`.
