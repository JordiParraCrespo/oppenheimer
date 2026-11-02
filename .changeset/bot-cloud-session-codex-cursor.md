---
"@oppenheimer/api": minor
---

Bots: `start_cloud_session` takes an `agent` and starts Codex's cloud
(`codex cloud exec` from a host, with an optional `codex_environment`) and
Cursor's (launched on the owner's own Cursor key, no host, an optional
`model`) as well as Claude Code's, through the same commands the console, tasks
and automations use. `get_session` shows a Cursor session's link, status and
pull request, and says a session with no host runs in its vendor's cloud.
