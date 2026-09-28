# @oppenheimer/frontend-web

The web platform kit: what `apps/web` builds on below its routes — the
authenticated shell, the auth chrome, page
layout, form plumbing, theming, i18n, analytics and browser glue. It is
source-exported (`main` points at `src/index.ts`), so the app's Vite build
compiles it and tree-shakes what it does not use.

The kit is organised by concern, not by kind: `src/<concern>/<kind>/`, with
the same kind directories a feature has. A concern imports another only
through that concern's `index.ts`, and the concerns are layered — `platform`,
`theme`, `i18n`, `analytics` and `forms` are leaves, `layout` and
`roles` build on them, `shell` and `auth` sit on top. The kit imports the
design system and `@oppenheimer/frontend-core`, never a product package: a
component that needs a product hook is a feature in an app, not kit.

## What it exports

Everything is re-exported from the package root (`src/index.ts`):

- **shell** — `AppShell`, `AppSidebar`, `TopBar`, `UserMenu`,
  `CommandPalette`, `ShellProvider`, `useShell`, `useAbility`,
  `useAbilityState`, `useAuthorizedNav`, `useLandingRoute`, `useHotkey`, and
  the nav types `NavItem`, `NavLink`, `NavPolicy`, `NavTo`, `ShellWorkspace`.
- **auth** — `AuthLayout`, `AuthArtPanel`, `BrandLogo`, `PasswordInput`,
  `SocialLoginButtons`, `OAuthCallbackNotice`, the auth primitives, the
  password-requirement helpers, the provider icons, `redirectSignedIn`.
- **layout** — `PageHead`, the section primitives, `ConfirmDialog` (the
  destructive confirm: `confirmLabel`, `pendingLabel`, `error`, `children`,
  `form`), `QueryState` (a read's failed / loading / empty / there, in that
  order, with `stale` naming what a later failure does to data on screen)
  and `combineQueries` (two reads as one source).
- **forms** — `ErrorAlert` (an inline failure: a raw `error` it resolves into
  the locale, or a `message` already resolved; its correlation id; Dismiss or
  the caller's own `action`), `useZodResolver`,
  `useSearchDraft`, `useServerFieldErrors`, the `ResolvedErrorMessage`
  type, and `notifySuccess(key, values?, action?)`: the success toast, which
  takes a `toasts.*` key so its copy cannot live anywhere else. Errors never
  go through it; they stay inline. When to toast is
  `.agents/rules/frontend-ui.md`. `useErrorMessage` itself is imported from
  `@oppenheimer/frontend-core/react`.
- **pairing** — `PairingChrome` and its parts, the column that pairs a
  machine.
- **theme** — `ThemeProvider`, `ThemeToggle`, `BrandGlyph`.
- **i18n** — `i18n`, `i18nReady`, `LOCALE_STORAGE_KEY`, `LanguageSwitcher`,
  `useLocale`, `useApplyUserSettings`, `RelativeTime` (a "2 hours ago" leaf
  that owns its clock), the date formatters (`formatMediumDate`,
  `formatAge`, …), the duration formatters (`formatCountdown`,
  `formatShortDuration`, `formatElapsed`) and the person-name helpers.
- **analytics** — `PageViewTracker`, `createWebAnalyticsClient`.
- **platform** — `LocalStorageService`, `sanitizeRedirect`.
- **roles** — `RolePill`.

`package.json` `sideEffects` names one file, `src/i18n/lib/i18n.ts`: it
configures i18next at import.

## How to use it

`apps/web/src/features/auth/forms/login-form.tsx` builds its form out of the
kit:

```tsx
import { AuthField, AuthFormFailure, useZodResolver } from '@oppenheimer/frontend-web';

const form = useForm<LoginDto>({
  resolver: useZodResolver(loginSchema),
});
```

`apps/web/src/routes/_authenticated.tsx` mounts the shell with the app's own
nav, and `apps/web/src/routes/_auth.tsx` mounts `AuthLayout` around both
halves of the first walk, each with its own guard below it. Always import by
package name; a path into `src/` fails `kit-through-its-entry` in the app's
own rules.

## How to run it

```bash
pnpm --filter @oppenheimer/frontend-web lint        # biome check src/
pnpm --filter @oppenheimer/frontend-web test        # vitest run
pnpm --filter @oppenheimer/frontend-web arch        # concern layering
pnpm --filter @oppenheimer/frontend-web typecheck   # tsc --noEmit; there is no build step
```

## Depends on / used by

Depends on `@oppenheimer/design-system-web`, `@oppenheimer/frontend-core`,
`@oppenheimer/shared` and `@oppenheimer/translations`; React, React Hook Form, i18next,
nuqs and TanStack Query/Router are peer dependencies the app provides. Used
by `apps/web`.
