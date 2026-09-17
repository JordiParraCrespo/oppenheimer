---
name: scaffold-feature
description: Scaffold a feature in a Oppenheimer frontend app (apps/web, apps/admin-web, apps/mobile, apps/admin-mobile). Use when the user asks to add a screen, page, section, dialog, form or feature to a frontend app, or mentions a new UI area for a domain module. Generates the kind directories (screens, sections, dialogs, forms, components, hooks, lib, __tests__) and a first screen that pass `pnpm check:structure` and the app's dependency-cruiser rules.
---

# Scaffold a frontend feature

Generate `features/<module>/` in one of the four frontend apps, following
`.agents/rules/frontend-architecture.md` and the app's `ARCHITECTURE.md`. The
`api-tokens` feature in `apps/web` is the reference — read it when unsure.

## Before generating

Ask for / infer:

1. **The app**: `web` or `mobile` (consumer product), `admin-web` or
   `admin-mobile` (control plane).
2. **The module** the feature renders. It must be a module of
   `packages/frontend/core` (`auth`, `users`, `user-settings`, `capabilities`,
   `analytics`) or of the app's product package
   (`packages/frontend/consumer`: `organizations`, `profile`, `api-tokens`;
   `packages/frontend/admin`: `admin-users`, `roles`), or on the app's short
   allowlist (`dashboard`, `public`). A feature named after a screen fails
   `pnpm check:structure`. If the module does not exist, add it to the
   product package first — the domain leads, the UI follows.
3. **What the user actually needs**: a screen, a section inside an existing
   screen, a dialog, a form. Most requests are one or two files in an existing
   feature, not a new feature.

## Generate

```bash
node scripts/scaffold-feature.mjs --app <app> --module <module> [--screen <name>]
```

It creates the eight kind directories, each with a `.gitkeep` that says what
goes there (delete it when the first file lands), and a first screen. Then
mount the screen from a route file — a route file holds the `Route`, its
`validateSearch`/`beforeLoad`/`staticData`, and a component that renders the
screen; nothing else, and never past 120 lines.

## Where each piece goes (the rules the checkers enforce)

| Piece | Directory | May import the query port / router | Notes |
| --- | --- | --- | --- |
| Page body a route mounts | `screens/` | yes | one per route |
| Pane, table, card group | `sections/` | yes | what a cross-module route (Settings) composes |
| A dialog | `dialogs/` | yes | one per file; owns its mutation; renders a form |
| A form | `forms/` | **no** | RHF over a shared Zod schema; props in, `onSubmit` out; `useZodResolver` from the kit |
| Row, cell, pill, hero, checklist | `components/` | **no** | props only; a `useWatch` lives here, at the leaf |
| Query + UI state, an effect | `hooks/` | yes | the only place `useEffect` may appear; comment names the external system |
| Types, mappers, constants | `lib/` | — | no JSX |

- Features never import each other (`features/a` → `features/b` fails
  `pnpm arch`). Something two features need moves to the platform kit
  (`packages/frontend/web` or `/mobile`) when the second consumer appears.
- Kind directories are flat: no sub-directories, no `index.ts` barrels.
  Routes import a screen by its path.
- No manual `useMemo`/`useCallback`/`memo` outside `hooks/`: the React
  Compiler is on. Biome enforces it.
- Reach for the kit and the design system before writing markup:
  `PageHead`, `SectionCard`, `DataTable`, `ConfirmDialog`, `AuthField`,
  `useTableQuery`, `useErrorMessage` are already there
  (`packages/frontend/web/src/index.ts`).
- Every user-facing string goes through `t()`; keys live in
  `packages/translations/<locale>/index.json`.

## After scaffolding

1. Fill the screen; split as it grows — a form into `forms/`, a dialog into
   `dialogs/`, a row into `components/`.
2. `pnpm --filter @oppenheimer/<app> arch` and `pnpm check:structure` — the Stop
   hook runs both.
3. `pnpm --filter @oppenheimer/<app> lint` (Biome + typecheck) and a spec in
   `__tests__/` for anything with logic.
4. For `apps/web`, a screen wired to the API needs an e2e spec in
   `e2e/tests/web/`.
