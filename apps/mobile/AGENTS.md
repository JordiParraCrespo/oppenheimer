# @oppenheimer/mobile — Agent Instructions

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first, then [`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Stack

- Expo + expo-router (`app/`); **expo-dev-client only** — Expo Go cannot load
  this app's native modules
- NativeWind + `@oppenheimer/design-system-mobile`; glue from `@oppenheimer/frontend-mobile`
- `expo-secure-store` for secrets only; **MMKV** for preferences and the cache
- React Hook Form + `useZodResolver`, one `Controller` per field — React Native
  has no DOM refs, so `register()` does not work
- `index.ts` imports `@oppenheimer/frontend-mobile/polyfills` **first**: nitro-fetch
  replaces global `fetch` before anything captures it

## Where code goes

- A screen → `features/<module>/screens/`, mounted by a route under 120 lines.
- A form → `features/<module>/forms/` (props in, `onSubmit` out; no fetching).
- A sheet → `features/<module>/dialogs/`, one per file, owns its mutation.
- A helper two screens use → `@oppenheimer/frontend-mobile`, not a second copy and not
  `lib/` (only `oppenheimer.ts`, `auth-client.ts`, `query.ts`).
- Logic — entities, repositories, query hooks → `@oppenheimer/frontend-consumer` or
  `@oppenheimer/frontend-core`. Never `@oppenheimer/frontend-admin`.

## Before pushing

```bash
pnpm --filter @oppenheimer/mobile lint && pnpm --filter @oppenheimer/mobile test
pnpm --filter @oppenheimer/mobile arch && pnpm check:structure
```

## Patterns agents get wrong

- Reaching for `useEffect` in a screen. Biome allows it only in `hooks/`; the
  one exception is `app/_layout.tsx`, whose single commented effect loads the
  config manager and the purchases SDK once per launch.
- Dropping `field.onBlur` in a `Controller`: `touched` never updates and
  blur-mode validation silently does nothing.
- Moving the nitro-fetch polyfill off the first line of `index.ts`, or changing
  the scheme in `lib/auth-client.ts` without matching `app.config.ts` and the
  API's `MOBILE_SCHEME`.

Placement is [`.agents/rules/frontend-architecture.md`](../../.agents/rules/frontend-architecture.md);
forms are [`.agents/rules/forms.md`](../../.agents/rules/forms.md).
