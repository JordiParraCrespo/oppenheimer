# @oppenheimer/frontend-web — concerns, layered

The web kit is what `apps/web` and `apps/admin-web` share below their routes.
Its top level is **concerns**, not kinds: `src/<concern>/<kind>/`, where the
kinds are the ones a feature has (`components/`, `dialogs/`, `hooks/`,
`lib/`). A concern is a subject the apps both have — the shell, the auth
chrome, the table — and everything that subject needs sits in one directory.

The package is source-exported: `main` and `exports` point at
`src/index.ts`, so each app's Vite build compiles it and tree-shakes it.
`package.json` `sideEffects` lists one file, `src/i18n/lib/i18n.ts`, because
importing it configures i18next; everything else is pure and may be dropped.

## The concerns

| Concern | What it holds | Layer |
| --- | --- | --- |
| `platform` | `LocalStorageService`, `sanitizeRedirect` — the browser, wrapped | leaf |
| `theme` | `ThemeProvider`, `useTheme`, `ThemeToggle`, `BrandGlyph` | leaf |
| `i18n` | the i18next instance and `i18nReady`, `useLocale`, `useApplyUserSettings`, `LanguageSwitcher`, the date and person-name formatters | leaf |
| `analytics` | `createWebAnalyticsClient` (PostHog), `PageViewTracker` | leaf |
| `forms` | `useZodResolver` | leaf |
| `table` | `DataTable` (a shell over a header, a body and a footer, so a keystroke in the search field does not re-render the rows), its column/facet/sort types, `useTableQuery`, `useClampedPage`, `useDebouncedCallback`, `paginateRows`, `downloadCsv` | middle |
| `layout` | `PageHead`, `FieldRow`, `RouteError`/`RouteNotFound`, `ConfirmDialog` | middle |
| `roles` | `RolePill` | middle |
| `shell` | `AppShell`, `AppSidebar`, `TopBar`, `UserMenu`, `CommandPalette`, `ShellProvider`/`useShell`, `useAbility`, `useAuthorizedNav`, the nav types | top |
| `auth` | `AuthLayout`, `AuthArtPanel`, `BrandLogo`, the auth primitives, `PasswordInput`, `SocialLoginButtons`, `OAuthCallbackNotice`, `redirectSignedIn` | top |

The lists live in [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs), which
passes them to `packages/tsconfig/depcruise/frontend-kit.cjs`.

## The layering, and why

A leaf imports only `@oppenheimer/design-system-web` and `@oppenheimer/frontend-core`.
A middle concern may import a leaf. A top concern may import anything below.
Nothing imports upwards.

The rule exists because `shell` is where everything is tempting to put. Left
unlayered, a date formatter would import `useShell` for the workspace's
locale, the table would import the sidebar for its width, and the shell would
become the dependency of every file in the package — one import cycle away
from being unbuildable, and impossible to render in a test without mounting
the whole app. Keeping `shell` and `auth` at the top means they compose the
kit and nothing composes them.

`AuthLayout` (top) importing `ThemeToggle` (leaf) and the `NavTo` type from
`shell` is the direction the rule allows; `theme` importing `auth` is not.

## Concerns meet at their index

`src/<concern>/index.ts` is the concern's public surface: it names each
export rather than re-exporting a directory, so what leaves the concern is
visible in one file. A concern imports another through that file only —
`import { useApplyUserSettings } from '../../i18n'`, never
`'../../i18n/hooks/use-apply-user-settings'`. `concerns-meet-at-their-index`
fails on the second form, and an app always imports `@oppenheimer/frontend-web`
itself, never a path into `src/`.

## How an app configures the shell

`AppShell` takes a `ShellConfig` (`src/shell/hooks/use-shell.ts`) and puts it
in context, so the sidebar, top bar and command palette read it instead of
being passed it. The app's `_authenticated` route decides who gets in and
what the shell shows — `apps/web/src/routes/_authenticated.tsx`:

```tsx
<AppShell
  nav={NAV}
  sidebar={<SessionsSidebar />}
  brand={<Wordmark size={18} product={t('common.product')} />}
  chrome={false}
>
  <Outlet />
</AppShell>
```

`nav` is the app's own `readonly NavItem[]` from its `lib/nav.ts`: each row
carries a route, an icon, a `nav.*` label key and the CASL `policies` its
destination needs, and `useAuthorizedNav` hides the rows the signed-in
ability does not satisfy. A gated row takes those `policies` from
`ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`, keyed by the method and
route its screen reads (`ENDPOINT_POLICIES['GET /tokens']`), rather than writing the
rules out — the API's own `endpoint-policies.spec.ts` pins its controllers to that
same entry. The kit
holds no route list: the URLs belong to each app, and the two Vite apps do not
share them.

The other four are slots, and the console is the app that uses them: `sidebar`
replaces the nav list between the brand row and the account menu (its own is a
feature, because it reads a product hook), `brand` replaces the workspace row
at the top, `userMenuLinks` are account-menu rows above appearance and
language, and `workspace` is what the sidebar header names when no `brand` is
given. `chrome` is the one that takes things away: `false` drops the 56px bar,
the ⌘K palette and the hairline above the account row, which is the console —
its sidebar is its content, and the version-1 artboards draw none of the
three.

A screen says how it wants to be framed with route `staticData.pane`:
`measure` (the default: the padded 1080px reading column) or `full`, which
hands the content area to the screen and keeps no scroll of its own.
`resolveContentPane` reads the innermost match that declares one, the same way
`AuthLayout` reads its legal note.

## How an app configures the auth layout

`AuthLayout` (`src/auth/components/auth-layout.tsx`) is the auth split: form
on the left, `AuthArtPanel` on the right, the panel dropped below 900px. It
takes `brandLabel` (the wordmark, defaulting to the product name), `links`
(footer links, typed `NavTo`) and `copy` (`'consumer' | 'control'`, which
product's words the art panel shows). The `_auth` route mounts it after
`redirectSignedIn` has decided who may be here — `apps/web/src/routes/_auth.tsx`:

```tsx
beforeLoad: ({ context, location }) =>
  redirectSignedIn({ context, location, landing: '/dashboard', allow: ['/accept-invitation'] }),
```

`apps/admin-web/src/routes/_auth.tsx` composes the same pieces
(`AuthArtPanel`, `BrandLogo`, `ThemeToggle`, `sanitizeRedirect`) by hand,
because the control plane has no public pages and its redirect rule differs.

## Add a concern

1. `mkdir src/<concern>` and, inside it, only the kind directories it needs:
   `components/`, `dialogs/`, `hooks/`, `lib/`. No sub-directories.
2. Write `src/<concern>/index.ts` naming each public export.
3. Add `export * from './<concern>'` to `src/index.ts`.
4. Put the concern in `leaves`, `middle` or `top` in
   [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs) — a concern that
   imports nothing but the design system and the kernel is a leaf.
5. If a file runs code when imported, add it to `sideEffects` in
   `package.json`, as `src/i18n/lib/i18n.ts` is.
6. `pnpm --filter @oppenheimer/frontend-web arch lint typecheck test`.

## What `pnpm arch` enforces

- `no-circular` — no import cycles, counting value imports only.
- `leaves-stay-leaves` — `platform`, `theme`, `i18n`, `analytics`, `forms`
  never import a middle or top concern.
- `middle-below-top` — `table`, `layout`, `roles` never import `shell` or
  `auth`.
- `concerns-meet-at-their-index` — a concern reaches another only through
  that concern's `index.ts`.
- `lib-has-no-jsx` — a concern's `lib/` may name React types but not import
  React for values.
- `kit-knows-no-product` — nothing here imports `@oppenheimer/frontend-consumer`
  or `@oppenheimer/frontend-admin`.
- `kit-knows-no-app` — nothing here imports `apps/`.
