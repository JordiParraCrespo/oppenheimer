# @oppenheimer/admin-mobile

The native control plane. It manages platform users — creating them and
assigning application roles — and the roles themselves, sharing those services
with [`apps/admin-web`](../admin-web). Consumer features belong in
[`apps/mobile`](../mobile); this app has no registration route.

Access is gated twice: the API restricts control-plane endpoints, and
`app/(app)/_layout.tsx` renders an access-denied panel unless the signed-in
profile reports `canAccessControlPlane`.

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
link scheme is `EXPO_PUBLIC_ADMIN_MOBILE_SCHEME` (default `oppenheimer-admin`), which
must match `ADMIN_MOBILE_SCHEME` on the API.

```bash
pnpm docker:dev                                # Postgres + Redis
pnpm --filter @oppenheimer/api dev                   # the API this app talks to
pnpm --filter @oppenheimer/admin-mobile prebuild     # regenerate ios/ and android/
pnpm --filter @oppenheimer/admin-mobile ios          # or: android
pnpm --filter @oppenheimer/admin-mobile dev          # Expo dev client on port 8083
pnpm --filter @oppenheimer/admin-mobile lint         # Biome + tsc --noEmit
pnpm --filter @oppenheimer/admin-mobile test         # Vitest
pnpm --filter @oppenheimer/admin-mobile arch         # dependency-cruiser
pnpm --filter @oppenheimer/admin-mobile build:dev    # EAS build (development profile)
```

## Layout

```
index.ts               # the nitro-fetch polyfill first, then expo-router/entry
app/                   # expo-router routes: a default export that mounts a screen
├── _layout.tsx        # providers, theme vars, error boundaries, AuthGate
├── (auth)/            # login, forgot-password, reset-password
└── (app)/             # the control-plane gate, the tabs, users and roles
features/              # admin-users/, roles/, auth/ — kind directories only
lib/                   # configuration only: oppenheimer.ts, auth-client.ts, query.ts
app.config.ts          # Expo config — the source of truth for native
metro.config.js, tailwind.config.js, global.css
```

## Where the shared code lives

- UI and native glue both Expo apps share — `FormField`, `useZodResolver`,
  `ErrorBoundary`, `ScreenViewTracker`, `NAV_THEME`, `createQueryPersistence`,
  `ExpoSecureStoreService` — are in `@oppenheimer/frontend-mobile`
  (`packages/frontend/mobile`), the same kit `apps/mobile` uses.
- Primitives are in `@oppenheimer/design-system-mobile`.
- Domain logic is in `@oppenheimer/frontend-core` (session, users, user settings,
  capabilities, analytics) and `@oppenheimer/frontend-admin` (admin-users, roles).
  This app loads the admin product and never the consumer one.

## More

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — the layers, the kind table, the
  route contract, the render rules, what the checkers enforce.
- [`AGENTS.md`](./AGENTS.md) — the short version for agents.
