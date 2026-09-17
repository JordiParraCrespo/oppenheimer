# @oppenheimer/frontend-mobile — concerns, layered

The mobile kit is what `apps/mobile` and `apps/admin-mobile` share below
their routes. Its top level is **concerns**, not kinds: `src/<concern>/<kind>/`,
where the kinds are the ones a feature has (`components/`, `hooks/`, `lib/`).
Most of what is here is glue — native modules, storage, a bundler-level
bootstrap — so `lib/` is the largest kind, and there is no `dialogs/`.

The package is source-exported: `main`, and one subpath per concern
(`./analytics`, `./config`, `./forms`, `./i18n`, `./layout`, `./platform`,
`./theme`, plus `./polyfills`), all pointing into `src/`. Metro compiles it
with the app.

## The concerns

| Concern | What it holds | Layer |
| --- | --- | --- |
| `platform` | `createQueryPersistence`, `ExpoSecureStoreService`, the MMKV stores (`storage`, `stateStorage`, `queryStorage`), `initPurchases`, `Sentry`/`sentryEnabled`, the fetch polyfills | leaf |
| `theme` | `THEME` (the NativeWind variable sets) and `NAV_THEME` for React Navigation | leaf |
| `config` | `configManager` over the kernel's `ConfigManager`, `AppConfig`, `staticConfig`, `ConfigManagerContext`, `useConfig` | leaf |
| `forms` | `useZodResolver`, `FormField` (a `Controller` field with its label and error) | leaf |
| `analytics` | `createMobileAnalyticsClient` (PostHog), `ScreenViewTracker` | leaf |
| `i18n` | the i18next instance, `LOCALE_STORAGE_KEY`, `setLocale`, `LanguageSwitcher` — it reads `platform`'s MMKV store for the saved locale | middle |
| `layout` | `ErrorBoundary`, `AppErrorFallback`, `ScreenErrorFallback` | middle |

There is no `top` list: nothing on mobile plays the part `shell` plays on
web. The lists live in [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs),
which passes them to `packages/tsconfig/depcruise/frontend-kit.cjs`.

## The layering, and why

A leaf imports only `@oppenheimer/design-system-mobile` and
`@oppenheimer/frontend-core`. A middle concern may import a leaf. Nothing imports
upwards, and the `top` list is empty so the rule is one line to read.

The rule exists for the reason it exists on web: the concern everyone reaches
for — here `platform`, with storage and the query client in it — must stay at
the bottom. If `platform` imported `i18n` for a message or `layout` for a
fallback screen, every app file would pull the whole kit in through the one
import it cannot avoid, and a unit test of a storage wrapper would need
i18next initialised. Keeping the arrows pointing down keeps
`createQueryPersistence` a function you can call in isolation.

## Concerns meet at their index

`src/<concern>/index.ts` is the concern's public surface. A concern imports
another through that file only — `import { storage } from '../../platform'`
in `src/i18n/lib/i18n.ts`, never `'../../platform/lib/mmkv'`.
`concerns-meet-at-their-index` fails on the second form.

## The query cache

`createQueryPersistence` (`src/platform/lib/query.ts`) is the mobile half of
the kernel's persistence policy. It builds a `QueryClient` from
`defaultQueryClientOptions`, wraps MMKV (`oppenheimer.query-cache`) in a
`createSyncStoragePersister`, and takes the version from
`Constants.expoConfig?.version`, so a new build or an OTA update starts from
a clean cache instead of hydrating stale response shapes. The app passes its
product's sensitive features through:

```ts
export const { queryClient, persistOptions } = createQueryPersistence({
  nonPersistedFeatures: CONSUMER_NON_PERSISTED_FEATURES,
});
```

Tokens never come near it: they live in `ExpoSecureStoreService`, which the
app binds as the kernel's `storage`.

## Imports that run code

Three files do work when imported, and all three are named in `sideEffects`:

- `@oppenheimer/frontend-mobile/polyfills` (`src/platform/lib/polyfills.ts`)
  replaces `fetch`, `Headers`, `Request` and `Response` with
  `react-native-nitro-fetch`. It is the first line of `apps/mobile/index.ts`:
  a polyfill imported second is a polyfill that did nothing.
- `@oppenheimer/frontend-mobile/i18n` (`src/i18n/lib/i18n.ts`) initialises i18next
  with the device locale and the saved preference. It is the first line of
  `apps/mobile/app/_layout.tsx`, before any screen renders a string.
- `src/platform/lib/sentry.ts` initialises Sentry when a DSN is configured.

`ScreenViewTracker` is the same idea in component form: Expo Router emits
nothing an analytics provider can observe, so the tracker renders `null` and
exists only so `usePageView(usePathname())` runs inside `OppenheimerProvider`. The
root layout mounts it beside the app's content.

## Add a concern

1. `mkdir src/<concern>` and, inside it, only the kind directories it needs:
   `components/`, `hooks/`, `lib/`. No sub-directories.
2. Write `src/<concern>/index.ts` naming each public export.
3. Add `export * from './<concern>'` to `src/index.ts` and a
   `"./<concern>": "./src/<concern>/index.ts"` entry to `package.json`
   `exports`.
4. Put the concern in `leaves` or `middle` in
   [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs).
5. If a file runs code at import, add it to `sideEffects`.
6. `pnpm --filter @oppenheimer/frontend-mobile arch lint test`.

## What `pnpm arch` enforces

- `no-circular` — no import cycles, counting value imports only.
- `leaves-stay-leaves` — `platform`, `theme`, `analytics`, `forms`, `config`
  never import `i18n` or `layout`.
- `middle-below-top` — `i18n` and `layout` import nothing above them (the
  `top` list is empty here).
- `concerns-meet-at-their-index` — a concern reaches another only through
  that concern's `index.ts`.
- `lib-has-no-jsx` — a concern's `lib/` may name React types but not import
  React for values.
- `kit-knows-no-product` — nothing here imports `@oppenheimer/frontend-consumer`
  or `@oppenheimer/frontend-admin`.
- `kit-knows-no-app` — nothing here imports `apps/`.
