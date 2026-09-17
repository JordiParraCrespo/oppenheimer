# @oppenheimer/frontend-mobile — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

What both Expo apps share below their routes, organised by concern. The
concern map, the layering and the "add a concern" cookbook are
[`ARCHITECTURE.md`](ARCHITECTURE.md); the tier's layer model is
[`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Where things go

- A component both Expo apps render → `src/<concern>/components/`, exported
  by name from `src/<concern>/index.ts`. A hook goes in `hooks/`, a wrapper
  over a native module in `lib/` (no JSX there).
- A new concern → `src/<concern>/` with the kind directories it needs, an
  `index.ts`, `export * from './<concern>'` in `src/index.ts`, a
  `"./<concern>"` entry in `package.json` `exports`, and the concern's name
  in the `leaves` or `middle` list of
  [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs).
- A file that runs code at import (a polyfill, an i18n bootstrap, an SDK
  init) → add it to `sideEffects` in `package.json`, or the bundler is free
  to drop it.
- Something only one app needs → it stays in that app's
  `features/<module>/<kind>/` until the second app asks for it.

## Before pushing

```bash
pnpm --filter @oppenheimer/frontend-mobile lint
pnpm --filter @oppenheimer/frontend-mobile test
pnpm --filter @oppenheimer/frontend-mobile arch
```

## Patterns agents get wrong

- Importing `@oppenheimer/frontend-consumer` or `@oppenheimer/frontend-admin` here.
  `kit-knows-no-product` fails; a component that needs a product hook is a
  feature in the app.
- Reaching into another concern's file (`../platform/lib/mmkv`) instead of
  its `index.ts` — `concerns-meet-at-their-index`.
- Keeping tokens in the query cache. `createQueryPersistence` writes to
  MMKV; credentials live in `ExpoSecureStoreService`, and sensitive features
  are named through `nonPersistedFeatures`.
- Writing a second copy of a helper in `apps/mobile` rather than promoting
  the first one here; `pnpm check:structure` compares basenames.

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
