# @oppenheimer/mobile

The consumer product's native app: sign-up and sign-in (password or a social
provider through a deep link), password reset, and the signed-in home screen.
Platform administration is a different app,
[`apps/admin-mobile`](../admin-mobile).

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

## Layout

```
index.ts               # the nitro-fetch polyfill first, then expo-router/entry
app/                   # expo-router routes: a default export that mounts a screen
├── _layout.tsx        # providers, theme vars, error boundaries, AuthGate
├── (auth)/            # login, register, forgot-password, reset-password
└── (app)/             # the tab layout and its screens
features/              # <module>/{screens,sections,dialogs,forms,components,hooks,lib,__tests__}
lib/                   # configuration only: oppenheimer.ts, auth-client.ts, query.ts
app.config.ts          # Expo config — the source of truth for native
metro.config.js, tailwind.config.js, global.css
```

## Where the shared code lives

- UI and native glue both Expo apps share — `FormField`, `useZodResolver`,
  `ErrorBoundary`, `ScreenViewTracker`, `NAV_THEME`, `configManager`,
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
