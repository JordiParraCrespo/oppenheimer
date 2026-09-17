# @oppenheimer/frontend-consumer — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

The consumer product's domain (`organizations`, `profile`, `api-tokens`) on
top of `@oppenheimer/frontend-core`. Platform-free logic only; the UI that renders
it lives in `apps/web`, `apps/mobile` or the platform kits. The layer model
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
  prefix in `onSuccess`; export both by name from `src/react/index.ts`.
- Data that must not be written to storage → its key prefix in
  `CONSUMER_NON_PERSISTED_FEATURES` (`src/react/persistence.ts`).
- Something the control plane also needs → promote it to
  `@oppenheimer/frontend-core` rather than copying it here.

## Before pushing

```bash
pnpm --filter @oppenheimer/frontend-consumer lint
pnpm --filter @oppenheimer/frontend-consumer test
pnpm --filter @oppenheimer/frontend-consumer arch
pnpm --filter @oppenheimer/frontend-consumer build   # the apps import dist/
```

## Patterns agents get wrong

- Calling `useOppenheimerApp()` in a product hook. The kernel container getter only
  knows kernel services; a consumer hook reads `useConsumerApp().organizations`.
- Importing `@oppenheimer/frontend-admin` to reuse a role type or invalidate a list.
  `products-never-meet` fails; the meeting point is a kernel contract, the way
  member lists meet on `MEMBER_LISTS_KEY` from `@oppenheimer/frontend-core/react`.
- Putting a component or a React Native/DOM import here. A product package is
  loaded by both platforms; `domain-knows-no-platform` fails.
- Importing `src/react/` from `src/modules/`. Services know nothing of React;
  the bindings sit on top.

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
