---
sidebar_position: 1
---

# `opp`, the CLI

`opp` drives Oppenheimer from a terminal: your hosts, the sessions on them,
automations, bots and the Plan board. People use it from a laptop and scripts
use it in CI. An agent in a session uses it to hand work to an agent on
**another host**, which `runner sessions run` (same host only) cannot do.

```bash
pnpm --filter @oppenheimer/cli build
alias opp="node $PWD/apps/cli/dist/bin/opp.js"

opp login                      # a scoped API token, pinned to your workspace
opp hosts list
opp sessions run --host mac-studio --repo acme/app "Run the iOS tests; report what fails"
opp sessions wait <id>         # until the agent is through, or needs you
opp sessions send <id> "Fix the first failure and push"
opp sessions transcript <id>   # what its agent said and did; --cursor reads on
opp bots chat juno "What failed overnight?"
```

Every command takes `--json`. Exit codes are a contract: `0` ok, `1` failure
(a `wait` that timed out included), `2` usage, `3` not signed in, `4` not
permitted, `5` not found, `6` API unreachable.

A token carries only the scopes it was given, never more than its creator
holds, and acts inside a workspace only when it is pinned to one. `opp login`
and `opp tokens create` pin it to yours. `apps/cli/README.md` lists every
command and the scopes each one needs.
