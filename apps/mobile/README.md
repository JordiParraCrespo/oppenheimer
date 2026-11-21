# @oppenheimer/mobile

Oppenheimer on a phone (0.5, `product/next-steps/0.5-mobile.md`), drawn from
the version-1 export's `Mobile.dc.html`. Today it is the shell: the welcome
screen (a social provider through a deep link, or email), email sign-in,
password reset, and the signed-in app's five sections in the console rail's
order (Sessions, Plan, Employees, Automations, Pull requests) in the system's
tab bar, with Account a sheet from the avatar on every tab. Account is real (who is signed in, light or dark, language, sign out);
The five sections say they are coming.
Signing up works here too: Create account, then the workspace step and
Ready (`app/onboarding/`); GitHub and the first host are added from the
console on the computer.

## Stack

- Expo with expo-router (file routes in `app/`); **expo-dev-client only** —
  Expo Go cannot load this app's native modules
- NativeWind with `@oppenheimer/design-system-mobile`
- TanStack Query, its cache persisted to MMKV
- i18next over `@oppenheimer/translations`
- React Hook Form with `zodResolver` over schemas from `@oppenheimer/shared`
- Better Auth Expo client, session stored in expo-secure-store

## Run it

Configuration comes from the **root `.env`**, loaded in `app.config.ts`. The
API base is `EXPO_PUBLIC_API_URL` (default `http://localhost:3001`) and the deep
link scheme is `EXPO_PUBLIC_MOBILE_SCHEME` (default `oppenheimer`), which must match
`MOBILE_SCHEME` on the API.

```bash
pnpm docker:dev                          # Postgres + Redis
pnpm --filter @oppenheimer/api dev             # the API this app talks to
pnpm --filter @oppenheimer/mobile prebuild     # regenerate ios/ and android/
pnpm --filter @oppenheimer/mobile ios          # or: android
pnpm --filter @oppenheimer/mobile dev          # Expo dev client, --clear
pnpm --filter @oppenheimer/mobile lint         # Biome + tsc --noEmit
pnpm --filter @oppenheimer/mobile test         # Vitest
pnpm --filter @oppenheimer/mobile arch         # dependency-cruiser
pnpm --filter @oppenheimer/mobile build:dev    # EAS build (development profile)
```

### Native builds across worktrees

The native app (the dev client) only changes when the native side does:
native dependencies, config plugins, `app.config.ts`, and the SVGs the icon
font is built from. Everything else is JavaScript that Metro serves. Xcode
keeps its build cache per folder, so every new worktree or clone used to start
with a full build. Two things now carry work over:

- **A build cache by fingerprint** (`build-cache.js`, `buildCacheProvider` in
  `app.config.ts`). `expo run:ios` on a simulator computes the project's
  fingerprint (`@expo/fingerprint`, with `fingerprint.config.js` adding the
  icon SVGs), which is the same in every checkout whose native side is the
  same, whatever its path. A Debug build is kept in
  `~/Library/Caches/oppenheimer/mobile-builds`, keyed by that fingerprint. A
  later checkout with the same fingerprint installs it and starts Metro,
  with no Xcode build. A native change gets a new fingerprint and builds
  once. The six most recently used builds are kept. Release builds (their
  JavaScript is inside the app) and Android (an APK is built for one
  device's ABI) always build.
- **ccache** (`expo-build-properties`, `ios.ccacheEnabled`) for the C, C++
  and Objective-C a native build compiles, when `ccache` is on the PATH at
  `pod install` (`brew install ccache`, then `prebuild`). It speeds up a
  rebuild in the same folder after `prebuild --clean`. Swift is not cached.

Reviewing a stack of pull requests needs one build per native change, not
one per pull request: check out each, `pnpm install`, `pnpm --filter
@oppenheimer/mobile ios`, and the ones that share a fingerprint start in
seconds. To build a fingerprint again, delete its entry from that folder
(`--no-build-cache` cleans the Xcode build but still takes a kept one).

## Layout

```
index.ts               # the nitro-fetch polyfill first, then expo-router/entry
app/                   # expo-router routes: a default export that mounts a screen
├── _layout.tsx        # providers, theme vars, error boundaries, AuthGate
├── (auth)/            # welcome, login (email), register, forgot-password, reset-password
├── onboarding/        # workspace (name it, claim its address), ready
└── (app)/             # (tabs)/: index (sessions), plan, employees, automations, pull-requests; account (a sheet)
features/              # <module>/{screens,sections,dialogs,forms,components,hooks,lib,__tests__}
lib/                   # configuration only: oppenheimer.ts, auth-client.ts, query.ts
app.config.ts          # Expo config — the source of truth for native
build-cache.js         # native builds kept by fingerprint, shared by every checkout
fingerprint.config.js  # what the fingerprint hashes beyond what it finds itself
native-sources.js      # inputs baked into the binary, shared by app.config.ts and the fingerprint
metro.config.js, tailwind.config.js, global.css
```

## Where the shared code lives

- UI and native glue — `FormField`, `useZodResolver`,
  `ErrorBoundary`, `ScreenViewTracker`, `NAV_THEME`, `TabScreen`, `TabPlaceholder`,
  `createQueryPersistence`, `ExpoSecureStoreService` — are in
  `@oppenheimer/frontend-mobile` (`packages/frontend/mobile`).
- Primitives are in `@oppenheimer/design-system-mobile`.
- Domain logic is in `@oppenheimer/frontend-core` (session, users, user settings,
  capabilities, analytics) and `@oppenheimer/frontend-consumer` (api-tokens,
  organizations, profile). This app loads the consumer product and never the
  admin one.

## More

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the layers, the kind table, the
  route contract, the render rules, what the checkers enforce.
- [`AGENTS.md`](./AGENTS.md) — the short version for agents.
