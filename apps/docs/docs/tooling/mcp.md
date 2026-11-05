---
sidebar_position: 2
---

# The MCP server

`apps/mcp` offers an MCP client (Claude Code, Claude Desktop, Cursor) the
same verbs as `opp` as tools: `list_hosts`, `start_session`,
`wait_for_session`, `send_to_session`, `read_session_transcript`, `create_automation`, `ask_bot`,
`create_task` and the rest. An agent connected to it sees only the tools its
credential's scopes cover, and the API checks the same scopes on every call.

```bash
pnpm --filter @oppenheimer/mcp build
opp tokens create --name "Claude" --permissions hosts:read,projects:read,sessions:write,bots:write
opp --token <that token> mcp install --client claude-code
```

`pnpm --filter @oppenheimer/mcp start:http` serves the same tools over
Streamable HTTP on `/mcp`, one server for many users, each request on its own
credential. Signing in remote clients through OAuth (the console's consent
screen) does not reach the workspace's tools yet, because an OAuth grant is
not pinned to an organization. `apps/mcp/README.md` has the details and the
configuration.
