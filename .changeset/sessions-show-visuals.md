---
'@oppenheimer/runner': minor
'@oppenheimer/web': minor
'@oppenheimer/frontend-consumer': minor
'@oppenheimer/shared': minor
---

A session's agent can show a visual in the session's chat: `runner sessions show <spec.json | ->`, or the `show_visual` tool of the runner's MCP server. The runner checks the spec's shape and refuses one it cannot draw with each fault by its path (`SESS_023`); the console draws it where it was shown, with the same renderer as the bots' visuals. `runner --skill` teaches it with an example.
