# @oppenheimer/mobile — Agent Instructions

Expo (React Native) app using expo-router.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions.

## Stack

- **Expo** + **expo-router** (file-based routes in `app/`)
- **NativeWind** (Tailwind for React Native) — see `tailwind.config.js`,
  `global.css`, `nativewind-env.d.ts`
- UI primitives from `@oppenheimer/design-system-mobile`
- **i18next** for i18n (translations from `@oppenheimer/translations`)
- **React Hook Form** + `zodResolver` for forms (`Controller` per field — the
  DOM-ref `register()` path does not work in React Native)
- **expo-dev-client** — Expo Go is not supported (Nitro, MMKV, Sentry, sheets)
- **expo-secure-store** for secrets only; **MMKV** for preferences and the query cache
- **TanStack Query** persisted to MMKV (policy from `@oppenheimer/frontend/react`)
- **nitro-fetch** polyfill in `index.ts` (must stay the first import)
- Overlays: gorhom bottom-sheet (KaikuLabs forks), `MobileRoot`, `toast()`

## Layout

```
index.ts              # polyfills first, then expo-router/entry
app/                  # expo-router screens/routes
components/            # app-local components
lib/                  # helpers (storage, config, sentry, query)
types/
app.config.ts         # Expo config (source of truth for native)
metro.config.js       # Metro (Sentry + NativeWind + gorhom source)
```

## Where code goes

- **Business logic lives in `@oppenheimer/frontend`**, not in screens. That package
  is shared with web; mobile injects platform-specific implementations (secure
  storage, etc.) via its InversifyJS DI container.
- Reusable UI comes from `@oppenheimer/design-system-mobile`.

## Forms

React Hook Form, validated by a Zod schema from `@oppenheimer/shared`. Full
convention in [`.agents/rules/forms.md`](../../.agents/rules/forms.md); the
short version:

- `useForm({ resolver: useZodResolver(schema) })` — always via
  `lib/use-zod-resolver.ts`, never `zodResolver` directly, or the messages come
  out untranslated.
- Every field goes through `Controller`: React Native has no DOM refs, so
  `register()` does not work. Wire `value`, `onChangeText` **and** `onBlur` —
  dropping `onBlur` leaves `touched` stale and silently disables blur-mode
  validation.
- Wrap each control in `components/form-field.tsx`, which mirrors the web
  `Field` (label + control + inline error). Validation failures belong inline,
  not in an `Alert`.

## Commands

```bash
pnpm --filter @oppenheimer/mobile prebuild  # regenerate ios/ android/
pnpm --filter @oppenheimer/mobile dev       # Expo dev client
pnpm --filter @oppenheimer/mobile ios
pnpm --filter @oppenheimer/mobile android
pnpm --filter @oppenheimer/mobile build:dev # EAS build (dev profile)
```
