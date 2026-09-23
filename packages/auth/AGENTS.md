# @oppenheimer/auth — Agent Instructions

Shared Better Auth configuration: the user-fields schema, the plugin options
both sides must agree on, and the client-side `unwrap`/`toAuthSession` helpers.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first.

## The one rule that matters

**`./client` ships TypeScript sources on purpose — never give it a build
step.** Better Auth derives client endpoint/session types from the plugin
tuple through inference chains that do not survive `.d.ts` emission. The
`exports["./client"]` map points at `src/client.ts`; Vite and Metro transpile
it in the consuming apps. Only the root entry (consumed by the NestJS API,
whose `tsc` cannot compile sources out of `node_modules`) is built to
CJS + `.d.ts` — and it must export only plain, explicitly typed values.

Consequences:

- `src/client.ts` is excluded from `tsconfig.json`'s build; it is type-checked
  by the consuming apps (`apps/web` runs `tsc -b` in its build).
- `src/session-preload.ts` is excluded for a second reason: it touches `window`,
  and the root build compiles against `lib: ES2022` with no DOM. It is browser
  code, reached only through `./client`. Anything else that needs `window`
  belongs there too, or in the app.
- Anything exported from the root entry must keep literal types
  (`as const satisfies ...`), or Better Auth's inference on the server degrades.

## What goes where

- Config both sides must agree on (user fields, the org `teams` flag) → here.
- Server-only options (database, hooks, emails, admin roles, OAuth) →
  `apps/api/src/auth/infrastructure/better-auth.config.ts`.
- Platform glue (cookies) → the apps.
- The `IAuthClient` contract → `@oppenheimer/frontend-core` (this package must not
  depend on it; `AuthSession` here mirrors it structurally).

## Commands

```bash
pnpm --filter @oppenheimer/auth build
pnpm --filter @oppenheimer/auth test
pnpm --filter @oppenheimer/auth lint
```

See [`.agents/rules/api-config.md`](../../.agents/rules/api-config.md) for how the API mounts this configuration and [`.agents/rules/frontend-architecture.md`](../../.agents/rules/frontend-architecture.md) for where the apps wrap the client.
