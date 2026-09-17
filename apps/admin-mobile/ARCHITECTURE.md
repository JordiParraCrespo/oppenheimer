# apps/admin-mobile Architecture — routes compose, features contain

`apps/admin-mobile` is the platform control plane on a phone: Expo with
expo-router, restricted to accounts that may reach the control plane. It
manages platform users and the application roles the consumer products read. It
owns its routes and its features and nothing else.

This document is the source of truth for the app. `.dependency-cruiser.cjs`,
`scripts/check-frontend-structure.mjs` and the scoped rule file
`.agents/rules/frontend-architecture.md` enforce what is described here. When
they disagree, fix the code or update both together. The tier-wide model is
[`packages/frontend/ARCHITECTURE.md`](../../packages/frontend/ARCHITECTURE.md).

## The layers

```
  index.ts                        polyfills, then expo-router/entry
  app/                            expo-router file routes
      │                           a default export that mounts a screen
      ▼
  features/<module>/              screens sections dialogs forms
      │                           components hooks lib __tests__
      ├──────────────► @oppenheimer/frontend-mobile     the mobile platform kit
      │                  ErrorBoundary, ScreenViewTracker, NAV_THEME,
      │                  configManager, initPurchases, createQueryPersistence,
      │                  ExpoSecureStoreService, FormField, useZodResolver
      │                       │
      │                       ▼
      │                @oppenheimer/design-system-mobile  NativeWind + rn-primitives
      │
      ├──────────────► @oppenheimer/frontend-admin      admin-users, roles
      │                       │
      └──────────────► @oppenheimer/frontend-core       auth, users, user-settings,
                              │                   capabilities, analytics, OppenheimerApp
                              ▼
                       @oppenheimer/api-client, @oppenheimer/shared
```

Imports run one way down that list. A feature never imports another feature;
the kit is imported by its package name (or one of its two side-effect
subpaths, `@oppenheimer/frontend-mobile/polyfills` and `/i18n`), never by a path into
its `src/`; this app loads `@oppenheimer/frontend-admin` and would fail `pnpm arch`
for touching `@oppenheimer/frontend-consumer`. The two products meet only at a kernel
contract — `useAssignUserRoles` invalidates `MEMBER_LISTS_KEY` rather than
importing the consumer package's keys.

## The anatomy of a feature

`features/<module>/` holds kind directories and nothing else — no `index.ts`,
no sub-directory inside a kind.

| Kind | What goes there | Fetch? | Router? | Example in this app |
| --- | --- | --- | --- | --- |
| `screens/` | the page body a route mounts | yes | yes | `admin-users/screens/users.tsx` |
| `sections/` | a pane, a card group, a list | yes | yes | — none yet in this app |
| `dialogs/` | one sheet or modal per file, owning its mutation | yes | yes | `admin-users/dialogs/assign-roles.tsx` |
| `forms/` | React Hook Form over a shared Zod schema; props in, `onSubmit` out | no | no | `roles/forms/role-form.tsx` |
| `components/` | entity UI: a row, a header, a pill | no | no | `auth/components/auth-header.tsx` |
| `hooks/` | `use-*.ts` over queries and UI state; the only home of an effect | yes | yes | — none yet in this app |
| `lib/` | types, mappers, constants; no JSX | no | no | `auth/lib/reset-password.ts` |
| `__tests__/` | Vitest specs | — | — | — |

`forms-and-components-stay-pure` is the cruiser rule behind the two "no"
columns: the screen or dialog above them fetches and passes the result down. On
mobile that matters twice over — `register()` has no DOM ref to take, so a form
is `Controller` per field and nothing else.

## A route file composes

An expo-router file is a default-exported component that mounts a screen. There
is no `Route` object here; the router's surface is the file's path, the
`_layout.tsx` above it, and `Redirect` / `Tabs` / `Stack` inside a layout. It
may read a feature's `lib/`, may not reach into `forms/`, `components/` or
`hooks/`, and stays under 120 lines.

```tsx
// app/(app)/roles.tsx
import { RolesScreen } from '../../features/roles/screens/roles';

export default function RolesRoute() {
  return <RolesScreen />;
}
```

`app/index.tsx` reads `useAuthState()` and redirects to `(app)` or
`(auth)/login`. `app/(app)/_layout.tsx` is the app's real gate: it reads
`useProfile()`, renders an access-denied panel unless
`user.canAccessControlPlane`, and otherwise declares the Users and Roles tabs.
`app/_layout.tsx` is the composition root — the providers, the theme vars, the
error boundaries, the `AuthGate`.

## Render rules

- **State lives in the lowest component that reads it.** The users screen owns
  which dialog is open; `assign-roles.tsx` owns its own mutation;
  `auth-header.tsx` owns nothing but its props.
- **Subscribe at the leaf.** A `useWatch` takes `control` and runs in the
  component that shows the value, never in the screen above it; the reference
  implementation is `apps/web/src/features/auth/components/password-checklist.tsx`.
- **An effect synchronises with something outside React, and says what.** Biome
  forbids `useEffect` outside `hooks/` — with one deliberate exception, the
  root layout. `app/_layout.tsx` keeps a single effect, commented as such,
  that loads the remote config manager and initialises the RevenueCat purchases
  SDK once per app launch. Both are imperative SDKs outside React and there is
  no component below the root that owns them.
- **The React Compiler is on** (`experiments: { reactCompiler: true }` in
  `app.config.ts`). No `useMemo`, `useCallback` or `memo` outside `hooks/`;
  Biome forbids the import.
- **One component per file.** Biome's `noNestedComponentDefinitions` is on.

## Add a feature

```bash
node scripts/scaffold-feature.mjs --app admin-mobile --module roles [--screen roles]
```

It creates the eight kind directories with a note in each and a first screen.
Then: write the screen, add a route under `app/(app)/` that mounts it, add a
`Tabs.Screen` for it in `app/(app)/_layout.tsx`, and add the translation keys.

Module names this app may use: the kernel's `analytics`, `auth`,
`capabilities`, `user-settings`, `users`, and the admin product's
`admin-users` and `roles`. This app has **no allowlist** — there is no
`dashboard` feature here. Anything else has to become a module of
`@oppenheimer/frontend-admin` first.

## What the checkers enforce

`pnpm --filter @oppenheimer/admin-mobile arch` (`.dependency-cruiser.cjs` over
`packages/tsconfig/depcruise/frontend-app.cjs`, across `app features lib`):

- `no-circular` — no import cycles, type-only edges excepted.
- `features-are-islands` — a feature never imports another feature.
- `routes-compose` — a route never imports a feature's `forms/`, `components/`
  or `hooks/`.
- `forms-and-components-stay-pure` — neither touches the query port or
  `expo-router`.
- `lib-has-no-jsx` — a feature's `lib/` imports `react` for types only.
- `one-product-per-app` — this app is the admin product and never loads
  `@oppenheimer/frontend-consumer`.
- `kit-through-its-entry` — `@oppenheimer/frontend-mobile` by its package name or one
  of its published subpaths, never by a path into `src/`.

`pnpm check:structure` — feature names against the module lists above, the kind
directories, no barrel and no sub-directory inside a kind, the 120-line route
cap, the `lib/` allowlist, no app file whose basename the kit already ships,
and that this app carries a README, an AGENTS.md linking a rule file, and this
document.

Biome (`overrides` in `biome.json`) — no `useEffect` outside `hooks/`, no
`useMemo`/`useCallback`/`memo` outside `hooks/`, no nested components.

## What is deliberately per-app

`lib/` holds configuration, never helpers: `oppenheimer.ts`, `auth-client.ts`,
`query.ts`. A fourth file fails `check:structure`. Each differs from the
sibling consumer app (`apps/mobile`) on purpose:

- **`oppenheimer.ts`** — `OppenheimerApp.create({ modules: adminModules })`. Loading the
  admin product's modules is what makes this app the control plane;
  `apps/mobile` runs the same file with `consumerModules`, which is why this
  bundle never carries organizations or API tokens.
- **`auth-client.ts`** — Better Auth with `expoClient({ scheme, storagePrefix:
  'oppenheimer-admin', storage: SecureStore })`. The prefix differs from
  `apps/mobile`'s `oppenheimer`, so the two apps cannot share a secure-store slot on
  the same device. `signUp` throws *"Control-plane accounts must be provisioned
  by an administrator"* — there is no registration route here — and
  `signInSocial` passes `requestSignUp: false` unconditionally, where
  `apps/mobile` lifts it on the register screen. The scheme comes from
  `EXPO_PUBLIC_ADMIN_MOBILE_SCHEME` (default `oppenheimer-admin`) and must match
  `app.config.ts` and `ADMIN_MOBILE_SCHEME` on the API, or the OAuth and
  password-reset deep links do not resolve back into the app. `getAuthHeaders`
  sends the stored cookie, since there is no browser to do it.
- **`query.ts`** — `createQueryPersistence()` with **no** argument. The admin
  product names no sensitive features of its own, so only the kernel's
  (`auth`, `userSettings`) are held back from the on-device MMKV cache;
  `apps/mobile` passes `CONSUMER_NON_PERSISTED_FEATURES` to add `apiTokens`
  and `profile`.
