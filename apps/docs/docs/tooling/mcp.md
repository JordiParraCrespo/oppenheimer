---
sidebar_position: 3
---

# MCP server

`apps/mcp` exposes the API to AI agents over the Model Context Protocol, with
per-tool permissions. It speaks protocol revision **`2026-07-28`**, and still
serves clients that open with the older 2025 handshake.

An agent connected to it only sees the tools its credential may actually use.
The tool list is filtered from the credential's **effective scopes** — what it
was granted, intersected with what its owner's roles still permit — and the API
enforces the same scopes independently on every call. A bug in the MCP layer
therefore costs you a missing tool, never unauthorized access.

## Two entrypoints, one registry

| Entrypoint | Command           | Credential                         | Use it for                           |
| ---------- | ----------------- | ---------------------------------- | ------------------------------------ |
| stdio      | `pnpm start`      | Scoped API token                   | Local clients: Claude Desktop / Code |
| HTTP       | `pnpm start:http` | Per-request OAuth 2.1 or API token | A hosted server serving many users   |

Tools are declared once in `src/tools/` and gated identically on both.

## Local setup

```bash
oppenheimer tokens create --name "Claude" --permissions users:read,roles:read
oppenheimer mcp install --client claude-code
```

`oppenheimer mcp status` shows what an agent currently sees. To change it, mint a
different token and run `install` again.

By hand:

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

## Remote setup

`pnpm start:http` serves Streamable HTTP on `/mcp`. A request without a valid
bearer token gets a `401` carrying
`WWW-Authenticate: Bearer resource_metadata=…`, which points the client at the
API's OAuth metadata; it registers itself, sends the user through the consent
screen, and comes back with an access token carrying the approved scopes.

The server is stateless — every request re-resolves its credential — so it
scales horizontally and one deployment serves every user at their own
permission level. `2026-07-28` made that the protocol's own model: there is no
`initialize` handshake and no `Mcp-Session-Id`, each request carries its
protocol version and client identity in `_meta`, and a plain round-robin load
balancer is enough because there is no session to keep two replicas agreeing
on.

| Variable                   | Default                 | Meaning                                  |
| -------------------------- | ----------------------- | ---------------------------------------- |
| `OPPENHEIMER_API_URL`            | `http://localhost:3001` | Base URL of the Oppenheimer API                |
| `OPPENHEIMER_API_TOKEN`          | —                       | Token for the stdio entrypoint           |
| `PORT`                     | `3005`                  | Port for the HTTP entrypoint             |
| `OPPENHEIMER_TIMEOUT_MS`         | `30000`                 | Per-request timeout against the API      |
| `OPPENHEIMER_TOOLS_CACHE_TTL_MS` | `60000`                 | How long a client may cache `tools/list` |
| `OPPENHEIMER_ALLOWED_ORIGINS`    | _(none)_                | Browser origins allowed to reach `/mcp`  |

`tools/list` results are returned with `ttlMs` and `cacheScope: "private"`, the
cache fields `2026-07-28` added. The scope is always private: the list is
derived from the caller's own permissions, so a shared cache must never hand
one user's list to another. Set the TTL to `0` to switch client caching off.

Requests carrying an `Origin` header from anywhere else are refused, which is
the DNS-rebinding protection the MCP specification asks for.

## Tools

26 tools across users, roles, organizations, members, invitations, workspaces
and privileged admin operations. Each declares the scopes it needs and carries
`readOnlyHint` / `destructiveHint` annotations so clients can decide what to
confirm.

`whoami` needs no permissions at all and reports what the connection can do —
worth calling first when an expected tool is missing.

## Adding a tool

```ts
defineTool({
  name: "archive_project",
  title: "Archive a project",
  description: "Archive a project. Archived projects stay readable.",
  requiredScopes: ["projects:write"],
  inputSchema: z.object({ id: z.string().uuid() }),
  annotations: { idempotentHint: true },
  handler: ({ id }, { client }) => client.post(`/projects/${id}/archive`),
});
```

The scope must exist in the shared catalog and the endpoint must declare the
same one via `@RequireScopes`, so the tool is offered exactly when it will
work.

## Writing tool descriptions

The description is the agent's only guide to when a tool applies. Say what it
does, what it affects, and anything irreversible — for example
`update_role_permissions` warns that it replaces the whole set, because an
agent that sends a partial list would silently strip permissions.
