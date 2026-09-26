# @oppenheimer/frontend-consumer — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

The console's domain on top of `@oppenheimer/frontend-core`: `sessions` (a
worktree with a terminal on a host), `projects` (what sessions belong to) and
`hosts` (the machines the user owns)
are the product; `organizations`, `profile` and `api-tokens` are the account
chrome it keeps. `organizations` is the *personal workspace* only — read it,
rename it, create one for an account that has none. Workspaces have no roster
(`product/versions/mvp/08-auth.md`): there is no member or invitation hook
here, on purpose, and the teams slice adds them when it arrives. Platform-free
logic only; the UI that renders it lives in `apps/web` or the web kit. The layer model
and the full "add a module" cookbook are
[`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Where things go

- A new module `things` → `src/modules/things/` with `thing.entity.ts`,
  `things.errors.ts`, `things.repository.ts`, `things.service.ts`,
  `things.module.ts` and `index.ts`; then `export * from './things'` in
  `src/modules/index.ts`, the two symbols in `src/di/tokens.ts`, and
  `ThingsModule` plus a `get things()` getter in `src/di/consumer-app.ts`.
  Only after that may `apps/web/src/features/things/` exist —
  `pnpm check:structure` allows a feature name a module carries.
- A new query hook → `src/react/things.queries.ts`, keys derived from
  `thingsKeys.all`, hooks over `useConsumerApp()`, mutations invalidating by
  prefix through `withCacheOnSuccess(options, update)` from
  `@oppenheimer/frontend-core/react`; export both by name from
  `src/react/index.ts`.
- Data that must not be written to storage → its key prefix in
  `CONSUMER_NON_PERSISTED_FEATURES` (`src/react/persistence.ts`).
- Something that is not product logic (every app would need it) → promote it
  to `@oppenheimer/frontend-core` rather than keeping it here.

## Before pushing

```bash
pnpm --filter @oppenheimer/frontend-consumer lint
pnpm --filter @oppenheimer/frontend-consumer test
pnpm --filter @oppenheimer/frontend-consumer arch
pnpm --filter @oppenheimer/frontend-consumer build   # the apps import dist/
```

## Patterns agents get wrong

- Calling `useOppenheimerApp()` in a product hook. The kernel container getter only
  knows kernel services; a consumer hook reads `useConsumerApp().sessions`.
- Adding a member or invitation hook to `organizations` because the API has
  the endpoint. The console has no roster; that surface is the teams slice's.
- Defining a query key or type here that the kernel owns, such as the member
  list prefix: use the kernel contract (`MEMBER_LISTS_KEY` from
  `@oppenheimer/frontend-core/react`).
- Putting a component or a DOM import here. A product package holds no
  platform code; `domain-knows-no-platform` fails.
- Importing `src/react/` from `src/modules/`. Services know nothing of React;
  the bindings sit on top.

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
