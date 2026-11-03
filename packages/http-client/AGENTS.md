# @oppenheimer/http-client — Agent Instructions

The transport `opp` and the MCP server share. Read the root
[`CLAUDE.md`](../../CLAUDE.md) first, and [`README.md`](./README.md) for the
exports.

## Rules

- **It never decides what a status means.** `request` answers every status;
  only a missing answer throws (`HttpTransportError`). Mapping a 401, 403 or
  404 onto exit codes or tool results is each client's, and stays there: the
  CLI's next-step hints and the MCP server's sentences for a model differ on
  purpose.
- **A failed answer is read by `readProblem` and nowhere else.** A new field
  of the problem document (`.agents/rules/nestjs-architecture.md`, "Structured
  errors") that a client should show is added here, once.
- **Keep it light.** `opp` loads it on every command an agent runs. Import
  `@oppenheimer/shared` by its narrow subpaths (`/types`), never the root
  barrel, which loads every Zod schema (measured: 41 ms of a 60 ms start).
- **No runtime state, no retries.** A retry policy needs an idempotency
  contract per endpoint; a client that wants one sends its own
  `Idempotency-Key` through `headers` and decides.
- Scoped credentials and what they reach are the API's
  (`.agents/rules/scopes-and-credentials.md`); this package only carries the
  bearer.

## Commands

```bash
pnpm --filter @oppenheimer/http-client build
pnpm --filter @oppenheimer/http-client test
pnpm --filter @oppenheimer/http-client lint
```
