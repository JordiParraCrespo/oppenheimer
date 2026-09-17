# @oppenheimer/web — Agent Instructions

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first for repo-wide conventions,
> and [`ARCHITECTURE.md`](./ARCHITECTURE.md) for this app's layers.

## Stack

- Vite SPA + TanStack Router (file routes in `src/routes/`; `src/routeTree.gen.ts`
  is generated — never edit it) + TanStack Query persisted to `localStorage`
- Tailwind v4 + `@oppenheimer/design-system-web`; shared web glue from `@oppenheimer/frontend-web`
- react-i18next; import locale metadata from `@oppenheimer/translations/locales` and
  catalogs from `@oppenheimer/translations/lazy`, never the package root
- React Hook Form + `useZodResolver` over schemas from `@oppenheimer/shared/schemas/*`
- Config from the **root `.env`** via `import.meta.env` (`envDir` in
  `vite.config.ts` points at the repo root; a `.env` here is not read)

## Where code goes

- A screen → `src/features/<module>/screens/`, mounted by a route under 120 lines.
- A form → `src/features/<module>/forms/` (props in, `onSubmit` out; never fetches).
- A dialog → `src/features/<module>/dialogs/`, one per file, owning its mutation.
- A helper or component a second screen wants → `@oppenheimer/frontend-web`, not a
  second copy and not `src/lib/` (that holds only `oppenheimer.ts`, `auth-client.ts`, `nav.ts`).
- Logic — entities, repositories, query hooks → `@oppenheimer/frontend-consumer` or
  `@oppenheimer/frontend-core`. Never `@oppenheimer/frontend-admin`.

## Telling the user something worked, or didn't

- **A failure stays on screen**: `<Alert variant="destructive">` next to what
  failed. Never a toast — a faded submission error cannot be re-read.
- **A success is transient**: `toast.success()` imported from
  `@oppenheimer/design-system-web` (not from `sonner`), copy under `toasts.*`.
- Field validation is neither: `Field` + `FieldError`.
- `<Toaster />` is mounted once in `src/app.tsx` and handed the app's own
  `theme`, because the design system's `Toaster` reads `next-themes` and this
  app does not run it — left alone it follows `prefers-color-scheme` and
  disagrees with the theme toggle.

## Before pushing

```bash
pnpm --filter @oppenheimer/web lint
pnpm --filter @oppenheimer/web test
pnpm --filter @oppenheimer/web arch
pnpm check:structure
pnpm check:bundle                 # after pnpm --filter @oppenheimer/web build
pnpm --filter @oppenheimer/e2e e2e:web  # a screen wired to the API gets a spec in e2e/tests/web/
```

## Patterns agents get wrong

- Naming a feature after the page (`settings`, `team`) instead of the module it
  renders. `/settings` composes `api-tokens`, `organizations` and `profile`.
- Putting `useWatch` or a query in the page and threading the value down.
  Subscribe at the leaf — `src/features/auth/components/password-checklist.tsx`.
- Hand-rolling a table or an error callout while `DataTable` and `Alert` sit
  exported. Read `packages/frontend/design-system/web/src/index.ts` before styling a `div`.

Placement is [`.agents/rules/frontend-architecture.md`](../../.agents/rules/frontend-architecture.md);
what the markup looks like is [`.agents/rules/frontend-ui.md`](../../.agents/rules/frontend-ui.md).
