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
`pairing` build on them, `shell` and `auth` sit on top. The kit imports the
design system and `@oppenheimer/frontend-core`, never a product package: a
component that needs a product hook is a feature in an app, not kit.

## What it exports

Everything is re-exported from the package root (`src/index.ts`), one
`export *` per concern. Each concern's `index.ts` is its catalog; this list
names the concern and what to reach for first.

- **shell** — `AppShell`, the authenticated frame (sidebar, top bar, user
  menu and command palette are its parts).
- **auth** — `AuthLayout`, the split screen around sign-in and onboarding.
- **layout** — `QueryState`, a read's failed, loading, empty and loaded
  states; `ConfirmDialog` for the destructive confirm.
- **forms** — `ErrorAlert` for an inline failure and `notifySuccess(key)` for
  a success toast (a `toasts.*` key, so its copy lives in one place; when to
  toast is `.agents/rules/frontend-ui.md`). `useErrorMessage` itself comes
  from `@oppenheimer/frontend-core/react`.
- **pairing** — `PairingChrome`, the column that pairs a machine.
- **theme** — `ThemeProvider`.
- **i18n** — `useLocale` and the formatters; `RelativeTime` for a "2 hours
  ago" that keeps moving.
- **analytics** — `PageViewTracker`.
- **platform** — `LocalStorageService`, `sanitizeRedirect`.

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
Zod and TanStack Query/Router are peer dependencies the app provides. Used
by `apps/web`.
