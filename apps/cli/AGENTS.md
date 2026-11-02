# @oppenheimer/cli — Agent Instructions

`opp`, the command-line interface, built on **commander**. It is a client of
the API over HTTP and nothing else: no database, no link, no runner.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions.

## Stack

- **commander** for the command tree, assembled in `src/program.ts`
- Talks to the API over HTTP via `src/lib/client.ts`, with response shapes
  hand-written in `src/lib/api-types.ts`, narrowed to the fields it reads
  (the generated client is TypeScript source for the console's bundler, not
  something a CommonJS binary can load)
- Credentials are API tokens governed by the **scope catalog** in
  `@oppenheimer/shared` (`packages/shared/src/scopes/`)
- Ships a single binary: `opp` → `dist/bin/opp.js`

## Layout

```
src/
├── bin/opp.ts     # executable entrypoint: errors → exit codes
├── program.ts     # command tree assembly
├── commands/      # one file per command group (auth, hosts, sessions, automations, bots, tasks, tokens, mcp)
├── lib/
│   ├── client.ts      # HTTP client; failures become CliErrors with the right exit code
│   ├── resolve.ts     # names (host, project, bot, owner/name) → ids, refusing ambiguity
│   ├── wait.ts        # polling a session or a bot's turn until it settles
│   ├── config.ts      # profiles
│   ├── context.ts     # the resolved run context
│   ├── output.ts      # human + JSON output
│   ├── prompt.ts      # interactive prompts
│   └── errors.ts      # exit codes
└── __tests__/
```

## Conventions

- **Exit codes are a public contract.** Never repurpose one:
  `0` ok, `1` failure, `2` usage, `3` auth, `4` forbidden, `5` not found,
  `6` unreachable. Map new failures onto these in `src/lib/errors.ts`.
- **A name is resolved or refused, never guessed.** Two hosts with the same
  name answer exit `2` and ask for the id (`pickByNameOrId`). Starting an agent
  on the wrong machine is worse than asking.
- New command groups go in `src/commands/` and are registered in `src/program.ts`.
- Every command hits an endpoint that declares `@RequireScopes`. A token
  without the matching scope must fail with exit code `4`, not a generic
  error. The README's Permissions table lists what each command needs. Roles
  say what a person may do and scopes what a credential may do for them;
  effective access is the intersection (`.agents/rules/scopes-and-credentials.md`).
- Writes that create something (`sessions run`, `automations run`) send an
  `Idempotency-Key`, so a retry after a lost answer does not make two.
- Keep human-readable output in `src/lib/output.ts` so `--json` stays a
  first-class, script-friendly path, and `--json` prints the API's payload.
- The CLI reads its environment from the shell, never from the repo's `.env`:
  it runs on machines with no checkout.

## Commands

```bash
pnpm --filter @oppenheimer/cli build
pnpm --filter @oppenheimer/cli dev     # tsc --watch
pnpm --filter @oppenheimer/cli start   # run the built binary
pnpm --filter @oppenheimer/cli test
pnpm --filter @oppenheimer/cli lint
```

The end-to-end proof is `e2e/tests/fleet/opp-cli.spec.ts` (a session on one
real host starts one on another with `opp`): build the CLI, bring the stack
up, then `pnpm --filter @oppenheimer/e2e e2e:fleet:local`.
