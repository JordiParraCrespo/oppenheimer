---
"@oppenheimer/api": minor
"@oppenheimer/cli": minor
"@oppenheimer/mcp": minor
---

A stopped session comes back without anyone opening it: bots get `restart_session` (a stopped session on a host only; `send_to_session` on a stopped one is refused with the way back), `opp sessions restart <id>` and the MCP server's `restart_session` call the API's restart.
