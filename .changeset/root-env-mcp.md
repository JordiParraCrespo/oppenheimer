---
"@oppenheimer/mcp": minor
---

Load the root `.env`, and prefer `MCP_PORT` over `PORT` so a shared root file cannot make the HTTP port collide with the API.
