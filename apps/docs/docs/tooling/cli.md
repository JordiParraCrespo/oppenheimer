---
sidebar_position: 2
---

# CLI

`oppenheimer` administers a deployment from the terminal, and mints the scoped
credentials everything else uses.

```bash
pnpm --filter @oppenheimer/cli build
node apps/cli/dist/bin/oppenheimer.js --help
```

## Signing in

```bash
oppenheimer login
```

Signs in with email and password, then immediately trades that session for a
scoped API token and stores **only the token**. The session never touches disk,
so what sits in your config is narrower than a login and revocable on its own.

```bash
oppenheimer login --permissions users:read,roles:read   # narrower still
oppenheimer login --with-token oppenheimer_pat_…              # use a token you already have
oppenheimer logout                                      # revokes it server-side
```

Config lives in `~/.config/oppenheimer/config.json` with mode `0600`
(`OPPENHEIMER_CONFIG` overrides the path). Profiles let one machine talk to several
deployments:

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
| `oppenheimer workspaces list \| create \| delete`                                 | Workspaces                                  |
| `oppenheimer tokens list \| create \| revoke \| permissions`                      | Scoped API tokens                           |
| `oppenheimer mcp install \| status`                                               | Connect an agent to this deployment         |

Add `--json` to any command for a machine-readable payload.

## Managing tokens

`oppenheimer tokens permissions` prints the catalog and marks what you may grant:

```
✓  users:read     Users — Read           List and read user records.
✓  users:write    Users — Edit           Update and delete user records.
·  admin:write    User administration    Ban, unban, impersonate, set passwords…
```

```bash
oppenheimer tokens create --name "CI" --permissions users:read \
  --expires-in 90 --allow-ip 203.0.113.0/24
```

The secret is printed once. Store it then, or mint another.

## Exit codes

Scripts can branch on the outcome:

| Code | Meaning                                   |
| ---- | ----------------------------------------- |
| 0    | Success                                   |
| 1    | Failure                                   |
| 2    | Bad usage (unknown command, missing flag) |
| 3    | Not authenticated                         |
| 4    | Authenticated but not permitted           |
| 5    | Not found                                 |
| 6    | API unreachable                           |

```bash
oppenheimer users get "$id" --json > user.json || case $? in
  4) echo "token is missing users:read" ;;
  5) echo "no such user" ;;
esac
```

## Environment

| Variable          | Meaning                                 |
| ----------------- | --------------------------------------- |
| `OPPENHEIMER_API_URL`   | Default API base URL                    |
| `OPPENHEIMER_API_TOKEN` | Credential to use, ahead of the profile |
| `OPPENHEIMER_PROFILE`   | Profile to use                          |
| `OPPENHEIMER_CONFIG`    | Path to the config file                 |
| `NO_COLOR`        | Disable colour output                   |
