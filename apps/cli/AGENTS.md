# @oppenheimer/cli — Agent Instructions

The `oppenheimer` command-line interface, built on **commander**.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions.

## Stack

- **commander** for the command tree, assembled in `src/program.ts`
- Talks to the API over HTTP via `src/lib/client.ts`
- Credentials are API tokens governed by the **scope catalog** in
  `@oppenheimer/shared` (`packages/shared/src/scopes/`)
- Ships a single binary: `oppenheimer` → `dist/bin/oppenheimer.js`

## Layout

```
src/
├── bin/          # executable entrypoint
├── program.ts    # command tree assembly
├── commands/     # one file per command group (auth, orgs, roles, tokens, users, mcp)
├── lib/          # shared plumbing
│   ├── config.ts     # config profiles
│   ├── client.ts     # HTTP client
│   ├── context.ts    # resolved run context
│   ├── output.ts     # human + JSON output
│   ├── prompt.ts     # interactive prompts
│   └── errors.ts     # error → exit-code mapping
└── __tests__/
```

## Conventions

- **Exit codes are a public contract** — do not repurpose them:
  `0` ok, `1` failure, `2` usage, `3` auth, `4` forbidden, `5` not found,
  `6` unreachable. Map new failures onto these in `src/lib/errors.ts`.
- New command groups go in `src/commands/` and are registered in `src/program.ts`.
- Every command hits an endpoint that declares `@RequireScopes`; a token without
  the matching scope must fail with exit code `4`, not a generic error.
- Keep human-readable output in `src/lib/output.ts` so `--json` stays a
  first-class, script-friendly path.
- Roles say what a person may do, scopes say what a credential may do on their
  behalf — effective access is the intersection. See
  `.agents/rules/scopes-and-credentials.md`.

## Commands

```bash
pnpm --filter @oppenheimer/cli build
pnpm --filter @oppenheimer/cli dev     # tsc --watch
pnpm --filter @oppenheimer/cli start   # run the built binary
pnpm --filter @oppenheimer/cli test
pnpm --filter @oppenheimer/cli lint
```
