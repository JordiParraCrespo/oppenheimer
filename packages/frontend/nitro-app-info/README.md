# @oppenheimer/nitro-app-info

A React Native Nitro module exposing native application information to the
Expo apps, with a Swift implementation for iOS and a Kotlin one for Android.
It exists as a worked example of a native module in this monorepo: the
TypeScript spec, the generated bindings and the two native sources, wired into
`apps/mobile` and `apps/admin-mobile`.

## What it exports

`src/index.ts`

- `appInfo` — the hybrid object, created once by `NitroModules.createHybridObject`.
  The loader is the only place that knows the platform matrix and throws on
  a platform it does not implement.

`src/AppInfo.nitro.ts`

- `AppInfo` — the spec (`getNativeModuleName()`), from which `nitrogen`
  generates the bindings under `nitrogen/`.

## How to use it

```ts
import { appInfo } from '@oppenheimer/nitro-app-info';

appInfo.getNativeModuleName();
```

## How to run it

```bash
pnpm --filter @oppenheimer/nitro-app-info nitrogen   # regenerate bindings after editing the spec
pnpm --filter @oppenheimer/nitro-app-info lint
```

The native sources are `ios/` and `android/`; `OppenheimerAppInfo.podspec` and
`nitro.json` register the module with the autolinking of each Expo app, which
runs with `expo-dev-client` (Expo Go cannot load a Nitro module).

## Depends on / used by

Peer-depends on `react-native-nitro-modules`. Used by `apps/mobile` and
`apps/admin-mobile`; pruned with them by the starter (`scripts/starter/features.json`).
