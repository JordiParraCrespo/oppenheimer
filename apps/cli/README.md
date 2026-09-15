# @oppenheimer/cli

`oppenheimer` — administer a Oppenheimer deployment from the command line.

```bash
pnpm --filter @oppenheimer/cli build
node apps/cli/dist/bin/oppenheimer.js --help
```

## Signing in

```bash
oppenheimer login
```

Signs in with your email and password, then immediately trades that session for
a **scoped API token** and stores only the token. The session is never written
to disk, so the credential sitting in your config is both narrower than a login
and revocable on its own:

```bash
oppenheimer login --permissions users:read,roles:read   # narrower still
oppenheimer login --with-token oppenheimer_pat_…              # use a token you already have
oppenheimer logout                                      # revokes it server-side
```

Config lives in `~/.config/oppenheimer/config.json` (mode `0600`), overridable with
`OPPENHEIMER_CONFIG`. Profiles let one machine talk to several deployments:

```bash
oppenheimer --profile staging login
oppenheimer --profile staging users list
```

## Commands

| Command                                                                     | What it does                                |
| --------------------------------------------------------------------------- | ------------------------------------------- |
| `oppenheimer whoami`                                                              | The credential, and what it can actually do |
| `oppenheimer users list \| get \| update \| delete`                               | The user directory                          |
| `oppenheimer roles list \| get \| create \| set-permissions \| delete \| assign`  | Roles and their permission rules            |
| `oppenheimer orgs list \| create \| delete \| members \| invite \| remove-member` | Organizations and membership                |
| `oppenheimer workspaces list \| create \| delete`                                 | Workspaces inside an organization           |
| `oppenheimer tokens list \| create \| revoke \| permissions`                      | Scoped API tokens                           |
| `oppenheimer mcp install \| status`                                               | Connect an agent to this deployment         |

Every command takes `--json` for a machine-readable payload.

## Permissions

`oppenheimer tokens permissions` prints the catalog and marks the parts you may
grant — a token can never carry more than its creator holds:

```
✓  users:read     Users — Read           List and read user records.
✓  users:write    Users — Edit           Update and delete user records.
·  admin:write    User administration    Ban, unban, impersonate, set passwords…
```

```bash
oppenheimer tokens create --name "CI" --permissions users:read \
  --expires-in 90 --allow-ip 203.0.113.0/24
```

The secret is printed once and never again.

## Connecting an agent

```bash
oppenheimer tokens create --name "Claude" --permissions users:read,roles:read
oppenheimer mcp install --client claude-code
```

The agent is offered only the tools those permissions cover. `oppenheimer mcp status`
shows what it currently sees.

## Exit codes

| Code | Meaning                                   |
| ---- | ----------------------------------------- |
| 0    | Success                                   |
| 1    | Failure                                   |
| 2    | Bad usage (unknown command, missing flag) |
| 3    | Not authenticated                         |
| 4    | Authenticated but not permitted           |
| 5    | Not found                                 |
| 6    | API unreachable                           |

## Environment

| Variable          | Meaning                                 |
| ----------------- | --------------------------------------- |
| `OPPENHEIMER_API_URL`   | Default API base URL                    |
| `OPPENHEIMER_API_TOKEN` | Credential to use, ahead of the profile |
| `OPPENHEIMER_PROFILE`   | Profile to use                          |
| `OPPENHEIMER_CONFIG`    | Path to the config file                 |
| `NO_COLOR`        | Disable colour output                   |
