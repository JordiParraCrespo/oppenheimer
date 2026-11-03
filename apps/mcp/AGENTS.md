# @oppenheimer/mcp — Agent Instructions

MCP (Model Context Protocol) server exposing Oppenheimer's API to MCP clients over
**stdio** and **Streamable HTTP**, speaking protocol revision **`2026-07-28`**.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions.

## Stack

- **@modelcontextprotocol/server** (SDK v2) server, built in `src/server.ts`;
  the HTTP entry bridges it onto Express with `@modelcontextprotocol/node`
- Two entrypoints, one server: `src/bin/stdio.ts` (local clients) and
  `src/bin/http.ts` (Streamable HTTP)
- **Zod 4** here only. The rest of the monorepo is still on Zod 3; the SDK v2
  requires 4, and `apps/mcp` imports no Zod schemas from `@oppenheimer/shared`, so
  the bump stops at this package
- Talks to the API over HTTP via `src/client.ts`, on `@oppenheimer/http-client`'s
  transport, which `opp` shares; the client turns a failure into `OppenheimerApiError`
- Access is governed by the **scope catalog** in `@oppenheimer/shared`
  (`packages/shared/src/scopes/`)

## Layout

```
src/
├── bin/
│   ├── stdio.ts          # stdio entrypoint (default `oppenheimer-mcp` binary)
│   └── http.ts           # Streamable HTTP entrypoint
├── server.ts             # server construction + tool registration
├── tools/                # the single tool registry
│   ├── tool.ts           # tool definition helper
│   ├── index.ts          # registry — register new tools here
│   └── *.tools.ts        # one file per domain (hosts, sessions, automations, bots, tasks)
├── client.ts
├── config.ts
└── __tests__/
```

## Conventions

- **One tool registry, two entrypoints.** Both binaries build the same server —
  never register a tool on only one transport.
- **Every tool declares `requiredScopes`.** The advertised tool list is filtered
  by the credential's effective scopes, so a tool without scopes is either
  invisible or over-exposed. Declare the _same_ scope the underlying endpoint
  requires via `@RequireScopes`.
  Mismatched scopes mean a tool that is offered but then refused — the one
  failure mode the design exists to prevent.
- New tools go in the matching `src/tools/*.tools.ts` and are added to the
  registry in `src/tools/index.ts`.
- `inputSchema` is a Zod **object schema** (`z.object({ … })`), not a raw
  shape. Do not import Zod schemas from `@oppenheimer/shared`: that is what keeps
  this package's Zod 4 from meeting the rest of the repo's Zod 3.
- The server is built **per request** from the calling credential, because
  protocol revision `2026-07-28` removed sessions: there is nowhere to cache
  the decision, and nowhere it could go stale. `tools/list` is sorted by name
  (the spec asks for a deterministic order) and returned with
  `cacheScope: 'private'`, since the list is derived from one credential's
  permissions.
- Annotate honestly: `readOnlyHint` only for tools whose scopes are all
  `:read`, `destructiveHint` for anything that deletes or is irreversible.
  `src/__tests__/server.spec.ts` enforces both.
- Adding an API endpoint you want reachable here means declaring its scope on
  the controller first — see `.agents/rules/scopes-and-credentials.md`.
- A tool that waits (`wait_for_session`, `ask_bot`) polls the API and holds
  the call for at most `MAX_WAIT_SECONDS` (300). It answers what it saw and
  whether the work settled, and the agent calls again; never block longer.
- Bounds come from `@oppenheimer/shared`'s constants (`FIELD_BOUNDS`,
  `fitsPromptBound`, `BOT_MESSAGE_MAX`, `TASK_TITLE_MAX`): constants, not
  schemas, so a too-long input is the tool's own error, phrased for the model.

## Outside `apps/mcp`

The API is the OAuth 2.1 provider that remote MCP clients sign in through.
Those pieces live with the API and the console, not here:

- `apps/api/src/auth/infrastructure/better-auth.config.ts`: Better Auth's
  `mcp()` plugin (discovery, dynamic client registration, the consent page,
  the scope catalog advertised as `scopes_supported`).
- `apps/api/src/auth/application/credential-scope.resolver.ts`: OAuth grants
  resolved beside API tokens. A grant is not pinned to an organization yet,
  so workspace routes refuse it (`product/next-steps/0.6-mcp-cli-and-agent.md`).
- `apps/web/src/routes/oauth/consent.tsx`: where the person approves or
  narrows a grant.

Both entrypoints load the root `.env` through `@oppenheimer/env` first, which
does nothing when the server is installed outside the repo.

## Commands

```bash
pnpm --filter @oppenheimer/mcp build
pnpm --filter @oppenheimer/mcp dev         # tsc --watch
pnpm --filter @oppenheimer/mcp start       # stdio transport
pnpm --filter @oppenheimer/mcp start:http  # Streamable HTTP transport
pnpm --filter @oppenheimer/mcp test
pnpm --filter @oppenheimer/mcp lint
```
