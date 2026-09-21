# @oppenheimer/frontend-web

What both Vite apps — `apps/web` and `apps/admin-web` — share below their
routes: the authenticated shell, the auth chrome, the data table, page
layout, form plumbing, theming, i18n, analytics and browser glue. It is
source-exported (`main` points at `src/index.ts`), so each app's Vite build
compiles it and tree-shakes what it does not use.

The kit is organised by concern, not by kind: `src/<concern>/<kind>/`, with
the same kind directories a feature has. A concern imports another only
through that concern's `index.ts`, and the concerns are layered — `platform`,
`theme`, `i18n`, `analytics` and `forms` are leaves, `table`, `layout` and
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
- **table** — `DataTable`, `DataTableColumn`, `useTableQuery`,
  `useClampedPage`, `downloadCsv`, the pagination helpers.
- **layout** — `PageHead`, the section primitives, `ConfirmDialog`.
- **forms** — `useZodResolver`; `useErrorMessage` is owned by frontend core and
  re-exported for compatibility.
- **theme** — `ThemeProvider`, `ThemeToggle`, `BrandGlyph`.
- **i18n** — `i18n`, `i18nReady`, `LOCALE_STORAGE_KEY`, `LanguageSwitcher`,
  `useLocale`, `useApplyUserSettings`, the date formatters
  (`formatMediumDate`, …) and the person-name helpers.
- **analytics** — `PageViewTracker`, `createWebAnalyticsClient`.
- **platform** — `LocalStorageService`, `sanitizeRedirect`.
- **roles** — `RolePill`.

`package.json` `sideEffects` names one file, `src/i18n/lib/i18n.ts`: it
configures i18next at import.

## How to use it

`apps/admin-web/src/features/admin-users/screens/users.tsx` builds its table
out of the kit:

```tsx
import {
  DataTable,
  type DataTableColumn,
  formatMediumDate,
  PageHead,
  RolePill,
  useTableQuery,
} from '@oppenheimer/frontend-web';

const query = useTableQuery<SortKey>({
  sort: { key: 'createdAt', order: 'desc', keys: ['name', 'email', 'createdAt'] },
});
```

`apps/web/src/routes/_authenticated.tsx` mounts the shell with the app's own
nav, and `apps/web/src/routes/_auth.tsx` mounts `AuthLayout` behind
`redirectSignedIn`. Always import by package name; a path into `src/` fails
`kit-through-its-entry` in the app's own rules.

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
by `apps/web` and `apps/admin-web`.
