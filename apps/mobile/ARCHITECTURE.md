# apps/mobile Architecture — routes compose, features contain

`apps/mobile` is the consumer product's native app: Expo with expo-router. It
owns its routes and its features and nothing else; every line of domain logic
and every component a second Expo app could want lives below it, in a package.

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
      ├──────────────► @oppenheimer/frontend-consumer   api-tokens, organizations, profile
      │                       │
      └──────────────► @oppenheimer/frontend-core       auth, users, user-settings,
                              │                   capabilities, analytics, OppenheimerApp
                              ▼
                       @oppenheimer/api-client, @oppenheimer/shared
```

Imports run one way down that list. A feature never imports another feature;
the kit is imported by its package name (or one of its two side-effect
subpaths, `@oppenheimer/frontend-mobile/polyfills` and `/i18n`), never by a path into
its `src/`; this app loads `@oppenheimer/frontend-consumer` and would fail
`pnpm arch` for touching `@oppenheimer/frontend-admin`.

## The anatomy of a feature

`features/<module>/` holds kind directories and nothing else — no `index.ts`,
no sub-directory inside a kind.

| Kind | What goes there | Fetch? | Router? | Example in this app |
| --- | --- | --- | --- | --- |
| `screens/` | the page body a route mounts | yes | yes | `auth/screens/login.tsx` |
| `sections/` | a pane, a card group, a list | yes | yes | — none yet in this app |
| `dialogs/` | one sheet or modal per file, owning its mutation | yes | yes | — none yet in this app |
| `forms/` | React Hook Form over a shared Zod schema; props in, `onSubmit` out | no | no | `auth/forms/login-form.tsx` |
| `components/` | entity UI: a row, a header, a pill | no | no | `dashboard/components/account-row.tsx` |
| `hooks/` | `use-*.ts` over queries and UI state; the only home of an effect | yes | yes | — none yet in this app |
| `lib/` | types, mappers, constants; no JSX | no | no | `dashboard/lib/account.ts` |
| `__tests__/` | Vitest specs | — | — | — |

`forms-and-components-stay-pure` is the cruiser rule behind the two "no"
columns: the screen above them fetches and passes the result down. On mobile
that matters twice over — `register()` has no DOM ref to take, so a form is
`Controller` per field and nothing else.

## A route file composes

An expo-router file is a default-exported component that mounts a screen. There
is no `Route` object here; the router's surface is the file's path, the
`_layout.tsx` above it, and `Redirect` / `Tabs` / `Stack` inside a layout. It
may read a feature's `lib/`, may not reach into `forms/`, `components/` or
`hooks/`, and stays under 120 lines.

```tsx
// app/(auth)/login.tsx
import { LoginScreen } from '../../features/auth/screens/login';

export default function LoginRoute() {
  return <LoginScreen />;
}
```

`app/index.tsx` is the one route with logic: it reads `useAuthState()` and
redirects to `(app)` or `(auth)/login`. `app/(app)/_layout.tsx` declares the
tabs. `app/_layout.tsx` is the composition root — the providers, the theme
vars, the error boundaries, the `AuthGate`.

## Render rules

- **State lives in the lowest component that reads it.** `LoginScreen` owns the
  submit error it shows; `LoginForm` owns the field state; `AccountRow` owns
  nothing but its props.
- **Subscribe at the leaf.** A `useWatch` takes `control` and runs in the
  component that shows the value, never in the screen above it; the reference
  implementation is `PasswordChecklist` in `@oppenheimer/frontend-mobile/auth`, which
  watches the password field so a keystroke re-renders the checklist and the
  button it gates, not the form.
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
node scripts/scaffold-feature.mjs --app mobile --module organizations [--screen organizations]
```

It creates the eight kind directories with a note in each and a first screen.
Then: write the screen, add a route under `app/` that mounts it, add it to the
`Tabs` in `app/(app)/_layout.tsx` if it is a destination, and add the
translation keys.

Module names this app may use: the kernel's `analytics`, `auth`,
`capabilities`, `user-settings`, `users`; the consumer product's `api-tokens`,
`organizations`, `profile`; and the app's allowlist entry, `dashboard`.
Anything else has to become a module of `@oppenheimer/frontend-consumer` first.

## What the checkers enforce

`pnpm --filter @oppenheimer/mobile arch` (`.dependency-cruiser.cjs` over
`packages/tsconfig/depcruise/frontend-app.cjs`, across `app features lib`):

- `no-circular` — no import cycles, type-only edges excepted.
- `features-are-islands` — a feature never imports another feature.
- `routes-compose` — a route never imports a feature's `forms/`, `components/`
  or `hooks/`.
- `forms-and-components-stay-pure` — neither touches the query port or
  `expo-router`.
- `lib-has-no-jsx` — a feature's `lib/` imports `react` for types only.
- `one-product-per-app` — this app is the consumer product and never loads
  `@oppenheimer/frontend-admin`.
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
`query.ts`. A fourth file fails `check:structure`.

- **`oppenheimer.ts`** — `OppenheimerApp.create({ modules: consumerModules })` with the
  kit's `ExpoSecureStoreService` and `createMobileAnalyticsClient()`. Loading
  the consumer modules is what makes this app that product;
  `apps/admin-mobile` runs the same file with `adminModules`.
- **`auth-client.ts`** — Better Auth with `expoClient({ scheme, storagePrefix:
  'oppenheimer', storage: SecureStore })`. `signUp` creates an account, and
  `signInSocial` passes `requestSignUp: intent === 'sign-up'` so only the
  register screen lifts the API's `disableImplicitSignUp`; the control plane's
  copy throws from `signUp` instead. The scheme comes from
  `EXPO_PUBLIC_MOBILE_SCHEME` (default `oppenheimer`) and must match `app.config.ts`
  and `MOBILE_SCHEME` on the API, or the OAuth and password-reset deep links do
  not resolve back into the app. `getAuthHeaders` sends the stored cookie, since
  there is no browser to do it.
- **`query.ts`** — `createQueryPersistence({ nonPersistedFeatures:
  CONSUMER_NON_PERSISTED_FEATURES })`. That list is the consumer product's:
  credentials (`apiTokens`) and the profile never reach the on-device MMKV
  cache, on top of the kernel's `auth` and `userSettings`.
  `apps/admin-mobile` calls the same factory with no argument, because the
  admin product names none.
