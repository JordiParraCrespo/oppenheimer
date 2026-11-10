# @oppenheimer/cli

`opp`: drive Oppenheimer from the command line. Start an agent on any of your
hosts, tell it more, wait on it; create automations; ask a bot; manage the
board. People use it from a laptop, scripts use it in CI, and an agent in a
session uses it to hand work to an agent on **another host**. The same
commands work in each case. The design is `product/next-steps/0.6-mcp-cli-and-agent.md`.

```bash
pnpm --filter @oppenheimer/cli build
node apps/cli/dist/bin/opp.js --help
```

## Signing in

```bash
opp login
```

Signs in with your email and password, then trades that session at once for
a **scoped API token** pinned to your workspace, and stores only the token.
The session is never written to disk. The stored credential is narrower than
a login, and you can revoke it on its own.

```bash
opp login --permissions hosts:read,projects:read,sessions:write   # narrower still
opp login --with-token oppenheimer_pat_…                          # a token you already have
opp logout                                                        # revokes it server-side
```

Config lives in `~/.config/oppenheimer/config.json` (mode `0600`), overridable
with `OPPENHEIMER_CONFIG`. With profiles, one machine can talk to several deployments
(`opp --profile staging login`).

## Handing work to another host

```bash
opp hosts list
opp sessions run --host mac-studio --repo acme/app "Run the iOS tests; report what fails"
opp sessions wait <id>                    # until it is through, or needs you
opp sessions get <id>                     # what it said, what it waits on
opp sessions transcript <id>              # its conversation, a page at a time (--cursor reads on)
opp sessions send <id> "Fix the first failure and push"
opp sessions close <id>
```

- `--repo owner/name` is found in your projects first, then in any GitHub App
  installation that grants it. `--project` uses the project's default
  repository and host. `--folder /path` runs in a folder already on the host.
- `send` works only while the agent waits at its prompt. The session's log
  records the prompt as yours.
- `wait` returns when the agent is idle, ready for review, waiting on you (a
  question, a permission, a failure) or gone. After `--timeout` (default
  `30m`) it exits `1`, and the session keeps running.
- `run --wait` and `send --wait` wait on the work they gave: a session that
  reads idle only because its agent has not started on the prompt yet is not
  done, so the wait ends once the session's log shows the agent took it.

## Commands

| Command | What it does |
| --- | --- |
| `opp login \| logout \| whoami` | The credential, and what it can actually do |
| `opp hosts list \| get` | Your machines, and which are online |
| `opp projects list` | Projects: repositories, default host and agent |
| `opp sessions list \| get \| run \| send \| wait \| stop \| close` | Sessions on your hosts |
| `opp sessions run --hidden`, `opp sessions hide \| show <id>` | Keep a session out of the console's sidebar, or show it again; it runs the same |
| `opp automations list \| create \| run \| pause \| resume \| delete` | Tasks that start a session on a schedule |
| `opp bots list \| chat` | Your bots (the console's Employees): `chat` waits for the answer |
| `opp tasks list \| add \| move` | Plan's board |
| `opp tokens list \| create \| revoke \| permissions` | Scoped API tokens |
| `opp mcp install \| status` | Connect an MCP client (`apps/mcp`) to this deployment |

Every command takes `--json` and then prints the API's payload unchanged.

## Permissions

A token can never carry more than its creator holds, and `opp tokens permissions`
marks what you may grant. What each command needs:

| Commands | Scopes |
| --- | --- |
| `sessions run` | `sessions:write`, `hosts:read`, `projects:read`, and `repositories:read` for a repository no project holds |
| `sessions transcript` | `sessions:read` |
| `sessions send \| stop \| close` | `sessions:write` |
| `automations create` | `automations:write`, `hosts:read`, `projects:read` |
| `bots chat` | `bots:write` |
| `tasks add \| move` | `tasks:write` |

A token acts inside a workspace only when it is pinned to exactly one.
`opp login` pins it to yours, and `opp tokens create` pins a new token to the
workspace of the credential that creates it unless `--organizations` says otherwise.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Failure (including a `wait` that timed out) |
| 2 | Bad usage (unknown command, missing flag, an ambiguous name) |
| 3 | Not authenticated |
| 4 | Authenticated but not permitted |
| 5 | Not found |
| 6 | API unreachable |

## Environment

| Variable | Meaning |
| --- | --- |
| `OPPENHEIMER_API_URL` | Default API base URL |
| `OPPENHEIMER_API_TOKEN` | Credential to use, ahead of the profile |
| `OPPENHEIMER_PROFILE` | Profile to use |
| `OPPENHEIMER_CONFIG` | Path to the config file |
| `NO_COLOR` | Disable colour output |

The CLI reads these from the shell and never from the repo's `.env`: it is
meant to be installed on machines that have no checkout.
