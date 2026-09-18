---
"@oppenheimer/mcp": minor
---

Entry points load the root `.env` (a no-op outside a workspace), and the HTTP
port now prefers `MCP_PORT` over `PORT` so a shared root `.env` can't make it
collide with the API.
