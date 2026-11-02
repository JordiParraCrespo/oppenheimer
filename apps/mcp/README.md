# @oppenheimer/mcp

The Model Context Protocol server for Oppenheimer: an agent connected to it
can see the person's hosts, start a coding session on any of them, prompt it,
wait on it, close it, schedule automations, ask a bot and work the Plan board.
It speaks protocol revision **`2026-07-28`**, and clients that still open with
the 2025 `initialize` handshake are served from the same tool registry. The
design is `product/next-steps/0.6-mcp-cli-and-agent.md`.

The agent sees only the tools its credential may use. The tool list is
filtered by the credential's **effective scopes** (what it was granted,
intersected with what its owner's roles still permit), and the API enforces
the same scopes on every call. A bug in this layer therefore costs a missing
tool, never unauthorized access.

## Two entrypoints, one tool registry

| Entrypoint | Command | Credential | Use it for |
| --- | --- | --- | --- |
| stdio | `pnpm start` | Scoped API token (`OPPENHEIMER_API_TOKEN`) | Local clients: Claude Code, Claude Desktop, Cursor |
| HTTP | `pnpm start:http` | A bearer per request (API token; OAuth 2.1 below) | One hosted server for many users |

## Quick start (local)

```bash
opp login
opp tokens create --name "Claude" --permissions hosts:read,projects:read,sessions:write,bots:write
opp --token <the token it printed> mcp install --client claude-code
```

`opp mcp status` shows what an agent currently sees. To change it, mint a
different token and run `install` again. By hand:

```json
{
  "mcpServers": {
    "oppenheimer": {
      "command": "node",
      "args": ["/path/to/oppenheimer/apps/mcp/dist/bin/stdio.js"],
      "env": {
        "OPPENHEIMER_API_URL": "http://localhost:3001",
        "OPPENHEIMER_API_TOKEN": "oppenheimer_pat_…"
      }
    }
  }
}
```

A token acts inside a workspace only when it is pinned to exactly one
organization, and `opp` pins the tokens it mints to yours. An unpinned token
connects, but every workspace tool answers "not permitted".

## Tools

| Area | Tools | Scopes |
| --- | --- | --- |
| Who | `whoami` | none |
| Hosts and projects | `list_hosts`, `list_projects` | `hosts:read`, `projects:read` |
| Sessions | `list_sessions`, `get_session`, `wait_for_session` | `sessions:read` |
| | `start_session` | `sessions:write`, `projects:read` |
| | `send_to_session`, `stop_session`, `close_session` | `sessions:write` |
| Automations | `list_automations` | `automations:read` |
| | `create_automation` | `automations:write`, `projects:read` |
| | `run_automation`, `pause_automation`, `resume_automation` | `automations:write` |
| Bots | `list_bots` | `bots:read` |
| | `ask_bot` | `bots:write` |
| Plan | `list_tasks` | `tasks:read` |
| | `create_task`, `move_task` | `tasks:write` |

The server's instructions tell the agent how to hand work to another host:
`list_hosts`, then `start_session` with a focused task, then
`wait_for_session`, then `get_session` and `send_to_session`. A session that
is waiting on you needs an answer from the person in the console.
`wait_for_session` and `ask_bot` hold the call for at most 300 seconds, and
the agent calls again while the work goes on.

`whoami` needs no permissions and reports what the connection can do. It is
worth calling first when an expected tool is missing.

## Remote (OAuth)

`pnpm start:http` serves Streamable HTTP on `/mcp`. A request without a valid
bearer token gets a `401` whose `WWW-Authenticate` header points at the API's
OAuth metadata (Better Auth's `mcp()` plugin). The client registers itself,
sends the person through the console's consent screen (`/oauth/consent`) and
comes back with an access token for the scopes they approved. The server is
stateless: every request re-resolves its credential.

Not yet usable for workspace tools: an OAuth grant is not pinned to an
organization, so the API answers the workspace's routes as it does for an
unpinned token. The fix is open in `product/next-steps/0.6-mcp-cli-and-agent.md`.
Until then, the hosted entrypoint works with pinned API tokens.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `OPPENHEIMER_API_URL` | `http://localhost:3001` | Base URL of the API |
| `OPPENHEIMER_API_TOKEN` | — | Token for the stdio entrypoint |
| `MCP_PORT` | `3005` | Port of the HTTP entrypoint (wins over `PORT`, which is the API's in a shared root `.env`) |
| `OPPENHEIMER_TIMEOUT_MS` | `30000` | Per-request timeout against the API |
| `OPPENHEIMER_TOOLS_CACHE_TTL_MS` | `60000` | How long a client may cache `tools/list` |
| `OPPENHEIMER_ALLOWED_ORIGINS` | _(none)_ | Browser origins allowed to reach `/mcp` |

A blank variable counts as unset. `tools/list` results carry `ttlMs` and
`cacheScope: "private"`, because the list is derived from the caller's own
permissions.

## Adding a tool

Add it to the right file in `src/tools/`, declaring the scopes it needs. They
are the same scopes as the endpoint's `@RequireScopes`, so the tool is offered
exactly when it will be accepted:

```ts
defineTool({
  name: 'restart_session',
  title: 'Restart a session',
  description: 'Restart a stopped session’s agent where it left off.',
  requiredScopes: ['sessions:write'],
  inputSchema: z.object({ session_id: z.string().uuid() }),
  annotations: { idempotentHint: true },
  handler: ({ session_id }, { client }) => client.post(`/sessions/${session_id}/restart`),
});
```
