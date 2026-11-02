---
"@oppenheimer/api": minor
"@oppenheimer/web": minor
"@oppenheimer/runner": minor
"@oppenheimer/shared": minor
"@oppenheimer/api-client": minor
"@oppenheimer/frontend-consumer": minor
"@oppenheimer/translations": minor
"@oppenheimer/extension": minor
---

Sessions in Claude Code's cloud. New session's Where offers *Claude Code
cloud* on a host: that host's runner fetches the repository with a token
sealed into the create, runs `claude --cloud <task>` in a scratch checkout,
reports the cloud session's id and keeps nothing. The session's pane has no
terminal: its state, *Open in claude.ai* and `claude --teleport <id>`. Its
state comes from the Chrome extension, which, connected with a personal token
pinned to the workspace, posts what it sees on claude.ai to
`POST /sessions/cloud-status`; the API records it for the sessions the
workspace launched (`place: cloud`, `cloudSessionId`, runner capability
`session.cloud`, errors `SESSIONS_037` and `SESS_008`).
