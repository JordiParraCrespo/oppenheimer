# 0.6 — MCP, CLI and agent

**Goal:** Oppenheimer driven by programs, not only by the console: an
MCP server so any agent can use it, a CLI for people and scripts, and an
agent of our own on top.

## What exists to build on

- API tokens and OAuth for MCP clients, governed by the scope catalog
  (`packages/shared/src/scopes/`, `.agents/rules/scopes-and-credentials.md`).
- The generated typed API client (`packages/frontend/api-client`).
- Note 00 §3's delegation primitives (`spawn_task`, `wait_task`,
  `send_message`) exposed through MCP, with the coordinator "just an
  agent with that MCP server enabled".
- The runner already is a CLI on the host (`runner sessions`, …); the
  starter's own CLI and MCP apps were pruned. They came back on 2026-11-02
  from the Flama boilerplate's `cli` and `mcp` plugins
  (`flama-ai-plugins`), rewritten for Oppenheimer (below).
- Host-side delegation exists (2026-11-02, from herdr-core): an agent in a
  session starts child sessions, types into them, waits for them and hears
  their reports through `runner sessions run|send|wait|report|children`
  (`runner --skill`). What 0.6 adds is the control-plane half: children the
  console lists, and the same verbs over MCP to agents on other hosts.

## Questions to answer first

1. Is "Agent" the delegation coordinator of note 00, an agent that runs
   unattended (the Agent SDK add-on note 01 keeps for later), or both?
2. Does the MCP server live in the API process (Better Auth's `mcp`
   plugin already serves OAuth) or as its own app?
3. One CLI for users, separate from `runner`, or `runner` grows user
   commands?
4. Which scopes does each surface need, and do new ones enter the
   catalog?

## What is built (2026-11-02)

The CLI and the MCP server, both thin clients of the API over HTTP, on the
same scoped API tokens, built from the Flama boilerplate's `cli` and `mcp`
plugins:

- **`opp` (`apps/cli`)**, for people, scripts and agents in sessions:
  `hosts`, `projects`, `sessions list|get|run|send|wait|stop|close`,
  `automations list|create|run|pause|resume|delete`, `bots list|chat`,
  `tasks list|add|move`, `tokens`, `mcp install|status`. Names (a host, a
  project, `owner/name`, a bot) resolve to ids or are refused when ambiguous.
  `wait` and `bots chat` poll the API until the work settles.
- **The MCP server (`apps/mcp`)**, stdio and Streamable HTTP: the same
  verbs as tools, offered only when the credential's effective scopes cover
  them, with instructions that tell an agent how to hand work to another
  host (`list_hosts` → `start_session` → `wait_for_session` →
  `send_to_session`).
- **`POST /v1/sessions/{id}/prompt`**, the one endpoint the API lacked: the
  bots' `send_to_session` command, now reachable by a person's credential,
  recorded in the log as `{ kind: 'person', userId }`.
- **The proof** is `e2e/tests/fleet/opp-cli.spec.ts`: an agent in a session on
  one real host runs `opp sessions run --host <other>`, and `opp` then
  prompts, waits on and closes the session on the other host.

## Answers so far

2. **The MCP server is its own app** (`apps/mcp`), not the API process: it
   is a client of the API like any other, built per request from the
   caller's credential, so it can run beside a desktop client (stdio) or as
   one hosted server (HTTP). The API keeps what is the API's: Better Auth's
   `mcp()` plugin, the OAuth provider remote clients sign in through.
3. **One CLI for users, separate from `runner`.** The CLI reaches
   automations, bots and tasks, which are workspace resources, not things on
   a host; carrying each over the runner's link would have copied the API
   into the link protocol. The runner stays the host agent, and `runner
   sessions run|send|wait` stays the same-host fast path with no credential.
4. **No new scopes.** Every tool and command needs the scope its endpoint's
   `@RequireScopes` already names (`apps/cli/README.md` has the table). A
   token acts inside a workspace only when it is pinned to exactly one
   organization, so `opp login` and `opp tokens create` pin the token to the
   caller's workspace.

## Still open

- **A credential inside a session without pasting a token.** An agent on a
  host runs `opp` today with a token it was given. The plan is the GitHub
  token's shape: the control plane mints a short-lived token scoped to the
  session over the link (`credentials.token` already exists for GitHub), the
  runner hands it to `opp` on that host, and it is revoked when the session
  ends.
- **`opp` on every host.** It is not installed with the runner yet. Either it
  ships in the runner's signed release, or `runner --skill` names how to get
  it; the second is cheaper, the first works offline.
- **OAuth grants carry no workspace.** An MCP client signed in through the
  consent screen is answered by workspace routes as an unpinned token is
  (refused), because `credential-scope.resolver.ts` gives grants no
  organization. With personal workspaces, the grant's tenant can be the
  owner's one organization; it is an auth-kernel change, so it waits for its
  own review. Until then, a hosted MCP server works with pinned API tokens.
- **Children the console lists.** A session `opp` starts is an ordinary
  session in the console; it is not yet shown as a child of the session that
  started it, the way `runner sessions run`'s children are on the host.
- **Question 1** (what "Agent" is) is unanswered.

## Decision log

- 2026-11-02: the CLI and the MCP server are separate apps over the API
  (questions 2 and 3), ported from the Flama boilerplate's plugins; no new
  scopes (question 4). A follow-up prompt over HTTP is
  `POST /sessions/{id}/prompt`, logged as sent by the person.
