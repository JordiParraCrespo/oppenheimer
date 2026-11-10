---
title: CLI and MCP
description: Driving Oppenheimer from scripts and other agents with the opp command line and the MCP server, signing in, scoped API tokens and their scopes, handing work to another host, the commands and tools available, exit codes, and current limits.
sidebar_position: 10
---

Two clients drive the same API the console uses, on **scoped API tokens**:

- **`opp`**, a command line for people, scripts and CI, and for an agent in a session that wants to hand work to an agent on **another host**.
- **The Oppenheimer MCP server**, which gives an MCP client (Claude Code, Claude Desktop, Cursor) tools for your hosts, sessions, automations, bots and tasks.

On the same host, an agent in a session does not need either: `runner sessions run` starts a child session there without a token ([Sessions](./sessions.md)).

## Getting `opp`

`opp` is built from the Oppenheimer repository (`apps/cli`); it is not yet shipped with the runner or as a package, so a host that should run it needs it installed and a token given to it.

## Signing in and tokens

```bash
opp login                                     # email and password, traded at once for a scoped token
opp login --permissions hosts:read,sessions:write   # a narrower token
opp login --with-token oppenheimer_pat_…      # a token you already have
opp whoami                                    # who you are and what the token can do
opp logout                                    # revokes the token
```

`opp login` never stores your session; it stores only the token, in `~/.config/oppenheimer/config.json` (mode 0600). Profiles let one machine talk to several deployments (`opp --profile staging login`). `OPPENHEIMER_API_URL` and `OPPENHEIMER_API_TOKEN` override the profile.

Tokens are managed with `opp tokens list | create | revoke | permissions`. A token:

- carries only the scopes it was given, never more than you hold (`opp tokens permissions` shows what you may grant);
- acts inside a workspace only when it is pinned to one; `opp login` and `opp tokens create` pin it to yours;
- is checked against your current roles on every call.

Scopes are `resource:read` or `resource:write` (write includes read), for resources such as `hosts`, `projects`, `sessions`, `automations`, `bots`, `tasks`, `repositories`, `pulls` and `inbox`.

| Command | Needs |
| --- | --- |
| `sessions run` | `sessions:write`, `hosts:read`, `projects:read`, and `repositories:read` for a repository no project holds |
| `sessions transcript` | `sessions:read` |
| `sessions send`, `stop`, `close` | `sessions:write` |
| `automations create` | `automations:write`, `hosts:read`, `projects:read` |
| `bots chat` | `bots:write` |
| `tasks add`, `move` | `tasks:write` |

The console has no page for API tokens; use `opp tokens`.

## Commands

| Command | Does |
| --- | --- |
| `opp hosts list \| get` | Your hosts and which are online |
| `opp projects list` | Projects with their repositories, default host and agent |
| `opp sessions list \| get \| run \| send \| wait \| stop \| close` | Sessions on your hosts |
| `opp sessions run --hidden`, `opp sessions hide \| show <id>` | Keep a session out of the console's sidebar, or show it again; it runs the same |
| `opp sessions transcript` | A session's conversation, a page at a time (`--cursor` reads on), secrets replaced |
| `opp automations list \| create \| run \| pause \| resume \| delete` | Automations |
| `opp bots list \| chat` | Your bots; `chat` waits for the answer |
| `opp tasks list \| add \| move` | Plan's board |
| `opp mcp install \| status` | Connect an MCP client to this deployment |

Every command takes `--json` and prints the API's answer unchanged. Names (a host, a project, `owner/name`, a bot) are resolved, and refused when ambiguous.

## Handing work to another host

```bash
opp hosts list
opp sessions run --host mac-studio --repo acme/app "Run the iOS tests; report what fails"
opp sessions wait <id>
opp sessions get <id>
opp sessions send <id> "Fix the first failure and push"
opp sessions close <id>
```

- `--repo owner/name` is looked up in your projects, then in any installation that grants it; `--project` uses the project's default repository and host; `--folder /path` runs in a folder already on the host.
- `send` works only while the agent waits at its prompt; the session's log records the prompt as yours.
- `wait` returns when the agent is idle, ready for review, waiting on you, or gone. After `--timeout` (default 30 minutes) it exits 1 and the session keeps running. `run --wait` and `send --wait` wait for the agent to take the prompt first.
- A session started this way is an ordinary session in the console.

Exit codes: 0 success, 1 failure (a timed-out wait included), 2 bad usage, 3 not signed in, 4 not permitted, 5 not found, 6 API unreachable.

## The MCP server

```bash
opp login
opp tokens create --name "Claude" --permissions hosts:read,projects:read,sessions:write,bots:write
opp --token <the token> mcp install --client claude-code
opp mcp status
```

The server runs over stdio with an API token, or as one hosted server over Streamable HTTP with a bearer token per request. An agent sees only the tools its token's scopes allow.

| Area | Tools |
| --- | --- |
| Who | `whoami` (call it first when a tool is missing) |
| Hosts and projects | `list_hosts`, `list_projects` |
| Sessions | `list_sessions`, `get_session`, `read_session_transcript`, `wait_for_session`, `start_session`, `send_to_session`, `set_session_visibility`, `stop_session`, `close_session` |
| Automations | `list_automations`, `create_automation`, `run_automation`, `pause_automation`, `resume_automation` |
| Bots | `list_bots`, `ask_bot` |
| Plan | `list_tasks`, `create_task`, `move_task` |

The usual flow is `list_hosts`, `start_session` with a focused task, `wait_for_session`, then `get_session` and `send_to_session`. `wait_for_session` and `ask_bot` hold a call for at most 300 seconds; call again while the work goes on. A session waiting on a permission or question needs the person to answer it in the console. Cloud sessions: a Cursor session takes `send_to_session` as a new run once its last run ended; Claude Code and Codex cloud sessions take none, and their transcripts are at the vendor.

## Limits

- Signing an MCP client in through OAuth (the console's consent screen) works, but such a grant is not tied to a workspace yet, so workspace tools refuse it. Use a pinned API token.
- An agent in a session has no automatic Oppenheimer credential; give it a token if it should run `opp`.
- Sessions started by `opp` are not shown as children of the session that started them.
