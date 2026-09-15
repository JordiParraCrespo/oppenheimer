# @oppenheimer/admin-web — Agent Instructions

Super-admin Vite SPA for platform users and application roles. Keep consumer
features in `apps/web`; this app is the platform control plane.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions.

## Stack

- **Vite** SPA + **TanStack Router** (file-based routes in `src/routes/`,
  generated tree in `src/routeTree.gen.ts` — do not edit by hand)
- **TanStack Query** for server state, persisted to `localStorage` (policy from
  `@oppenheimer/frontend/react`, wired in `src/providers/query-provider.tsx`)
- **Tailwind CSS v4** + **shadcn/ui** (from `@oppenheimer/design-system-web`)
- **react-i18next** for i18n (translations from `@oppenheimer/translations`)
- **React Hook Form** + `zodResolver` for forms
- Config via Vite env vars (`import.meta.env`, `VITE_`-prefixed), loaded from
  the root `.env` (`envDir` points at the repo root — a `.env` in this app
  directory is deliberately not read)

## Layout

```
src/
├── main.tsx          # app bootstrap
├── app.tsx
├── routes/           # TanStack Router file-based routes
├── components/       # app-local UI
├── providers/        # React context providers (query, i18n, DI)
├── lib/              # helpers
├── styles/
└── types/
```

## Where code goes

- **Business logic lives in `@oppenheimer/frontend`**, not in app components. The
  frontend package (clean architecture + InversifyJS DI + Zustand) is shared
  with mobile; inject platform-specific implementations via its DI container.
- **UI primitives come from `@oppenheimer/design-system-web`.** Before styling a
  `div`, read `packages/design-system/web/src/index.ts` and check whether the
  component already exists — do not go from memory. The full table of what to
  reach for is in [`.agents/rules/frontend-ui.md`](../../.agents/rules/frontend-ui.md).
- **A picker over a workspace list is a `Combobox`.** A field choosing one
  teammate or resource takes the autocomplete — with `onQueryChange`
  wired to the query that fetches its options, so typing asks the API rather
  than filtering the page already in hand. `Select` stays for fixed product
  lists (a stage, a source). The full table of which control picks what is in
  [`.agents/rules/frontend-ui.md`](../../.agents/rules/frontend-ui.md).
- **A route file composes.** `src/routes/` holds the `Route`, the page
  component and its queries; dialogs, cells and tabs go in
  `src/components/<feature>/`. `components/team/` is the shape to copy. Layout vocabulary shared by more than one feature sits at
  the top of `components/` (`section-ui.tsx`), not inside whichever feature
  needed it first.
- **The second time you write a helper, it moves to `src/lib/`.** Look there
  first — `download-csv`, `format-date`, `use-locale`, `use-copy`,
  `use-error-message`, `use-zod-resolver` are all there because they were
  written two or three times before.
- Server calls go through `@oppenheimer/api-client` (generated) wrapped in
  `@oppenheimer/frontend` data-access.

## Dates, numbers and locale

Format through `src/lib/format-date.ts`, taking the locale from `useLocale()`.
Never `toLocaleDateString()` with no argument — that ignores the user's
language setting entirely — and never a bare `i18n.language` or
`i18n.resolvedLanguage`: the first is wrong after a fallback, the second is
`string | undefined`. Constructing an `Intl` formatter inside render is the
expensive way to do it; `dateFormatter()` caches them.

## Data the product does not have yet

Render nothing. No badge is honest where a wrong one is not — the sidebar
shipped a hardcoded count to every user for months because a placeholder
outlived the comment promising to remove it. A component names the total it wants and
the shell resolves it from a query; unresolved stays `undefined`.

## Forms

React Hook Form, validated by a Zod schema from `@oppenheimer/shared`. Full
convention in [`.agents/rules/forms.md`](../../.agents/rules/forms.md); the
short version:

- `useForm({ resolver: useZodResolver(schema) })` — always via
  `src/lib/use-zod-resolver.ts`, never `zodResolver` directly, or the messages
  come out untranslated.
- `register()` for plain inputs, `Controller` for `Select`, checkbox groups and
  other ref-less controls.
- Errors render through the design system's `Field` / `FieldError`, which
  already accept React Hook Form's error shape. Set `data-invalid` on the
  `Field` and `aria-invalid` on the control, and put `noValidate` on the
  `<form>` so the native layer does not compete.
- Import auth schemas from `@oppenheimer/shared/schemas/auth`, not the package root —
  see the bundle note in the repo-root `AGENTS.md`.

## Telling the user something worked, or didn't

Two surfaces, and the split is not a matter of taste:

- **A failure the reader has to act on stays on screen**, as
  `<Alert variant="destructive">` next to the thing that failed — above the
  first field of a form, inside the dialog that could not submit, above the
  card whose query failed. It is still there when they look back, which is the
  point. Never a toast: a submission error that has faded is an error the
  reader cannot re-read.
- **A success is transient**, and goes through `toast.success(...)` imported
  from `@oppenheimer/design-system-web`. The screen has already changed — the dialog
  closed, the row went away — so the message confirms rather than informs.
  Never an `Alert`: a success banner has no dismiss story and ends up living in
  the layout forever.

`<Toaster />` is mounted once in `app.tsx` and handed the app's own `theme`,
because the design system's `Toaster` reads `next-themes` and this app does not
run it — left alone it follows `prefers-color-scheme` and disagrees with the
theme toggle.

Field-level validation is neither of these: that is `Field` / `FieldError`, in
Forms above.

Toast copy lives under `toasts.*` in `@oppenheimer/translations`, one key per
message, in every locale. Import `toast` from the design system rather than
from `sonner` — the app does not depend on `sonner` directly, and the barrel is
where UI comes from.

## Delivery and first load

Identical to `apps/web`, down to the same `nginx.conf`, the same two `public/`
bootstrap scripts and the same budget check — read
[`apps/web/AGENTS.md`](../web/AGENTS.md#delivery-and-first-load) for the rules
and the reasoning. A change to one of those files almost always belongs in both
apps; the shared parts (`@oppenheimer/config/vite-chunks.mjs`, `consumeSessionPreload`
in `@oppenheimer/auth`, the lazy catalogs in `@oppenheimer/translations`) are shared exactly
so the two cannot drift apart silently.

## End-to-end tests

The repo-root `e2e/` package holds Playwright specs that drive the **real
stack** — this app against the running API, its Postgres and its Redis. Nothing
is stubbed: a spec that passed against a mock would say nothing about whether a
screen is wired to the API, which is the only thing these tests exist to answer.
The browser specs live in `e2e/tests/web/`; how to run them is in
[`e2e/README.md`](../../e2e/README.md).

Conventions:

- Start from `provisionedUser()` in `e2e/support/web.ts` — an account that
  already owns a workspace — unless the spec is about registration or
  onboarding. Registering creates an account and nothing else; an account with
  no workspace is sent to `/onboarding`, so a spec that registers through the
  UI and expects the dashboard is asserting a flow that no longer exists.
- Sign in through the form (`signInAs`); the session is an httpOnly cookie, so
  there is no storage state to reuse.
- Assert persistence with `reloadFromServer`, not `page.reload()`. The query
  cache is persisted to local storage with a stale window, so a plain reload can
  re-render the value the page itself just wrote.
- Address elements by role and accessible name. When a name collides with the
  app chrome, scope the query to a landmark rather than reaching for a test id.
- Every spec mints its own account and workspace, so the suite runs in parallel
  and nothing has to be put back. Stamp anything else you create with
  `Date.now()`: a fixed name makes the *first* test fail on the second run.
- **A screen wired to the API gets a spec.** Team was the largest surface in
  the app and the last to get one, which is the wrong way round.

## Commands

```bash
pnpm --filter @oppenheimer/web dev
pnpm --filter @oppenheimer/web build
pnpm --filter @oppenheimer/web preview
pnpm --filter @oppenheimer/web lint
pnpm --filter @oppenheimer/web test        # Vitest over src/lib and the shell hooks
pnpm --filter @oppenheimer/e2e e2e:web     # Playwright, against a live API
```
