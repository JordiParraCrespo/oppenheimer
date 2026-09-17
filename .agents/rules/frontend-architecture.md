---
paths:
  - "apps/web/**/*"
  - "apps/admin-web/**/*"
  - "apps/mobile/**/*"
  - "apps/admin-mobile/**/*"
  - "packages/frontend/**/*"
---

# Frontend Architecture Rules

Where a thing goes on the frontend, and what it may import. Every rule here is
checked: dependency-cruiser (`pnpm arch`) for imports, `pnpm check:structure`
for names and shapes, Biome for effects and memo. The Claude Code Stop hook
runs all three. The layer model and the cookbooks are in
[`packages/frontend/ARCHITECTURE.md`](../../packages/frontend/ARCHITECTURE.md)
and each app's `ARCHITECTURE.md`; `/scaffold-feature` produces the shape.

Each rule below was written after finding the thing it forbids in a project
built from this starter.

## Placement: four questions, in order

| Question | Answer | Goes in |
| --- | --- | --- |
| Is it logic (an entity, a repository, a service, a query hook)? | used by both products | `packages/frontend/core` |
| | used by one product | `packages/frontend/consumer` or `/admin` |
| Is it UI or platform glue shared by both apps of a platform? | web | `packages/frontend/web` |
| | mobile | `packages/frontend/mobile` |
| Is it a primitive with the same API on both platforms? | | `packages/frontend/design-system/web` and `/mobile` |
| Everything else | | `apps/<app>/features/<module>/<kind>/` |

Two cells are never filled: logic in a platform kit (mobile would have to copy
it) and UI in a product package (it would need `react-dom` or `react-native`).
When something seems to need one of them it is two things glued together: the
hook goes down to a product package, the component sideways to the kit.

## A feature is named after a module

`features/<module>/` takes its name from a module of `packages/frontend/core`
or of the app's product package, or from the app's short allowlist
(`public` in `apps/web`: pages that render no entity). Never after a screen: `settings/` held
`api-tokens` and `organizations`, `team/` held `roles`, `chat/` was
`conversations`, and every one of those cost an agent a search. If the module
does not exist, add it to the product package first; the domain leads.

## A feature holds kind directories, and nothing else

```
features/<module>/
├── screens/      # what a route mounts; may fetch, may use the router
├── sections/     # a pane, a table, a card group; may fetch
├── dialogs/      # one dialog per file, owns its mutation; may fetch
├── forms/        # React Hook Form over a shared Zod schema; props in, onSubmit out; never fetches
├── components/   # entity UI: row, cell, pill, hero; props only; never fetches
├── hooks/        # use-*.ts; queries + UI state; the only place an effect lives
├── lib/          # types, mappers, config; no JSX
└── __tests__/
```

- A kind directory holds files, never a sub-directory. `automations/panels/`,
  `inbox/detail/` and `creator/behavior/steps/` were three answers to one
  question. A feature that wants a sub-directory is two features.
- No `index.ts` inside a feature. A route imports the screen by its path. A
  barrel that re-exported twenty-five symbols protected nothing and cost Vite
  a chunk.
- Filenames are kebab-case with no kind suffix; the directory is the kind.

## Imports flow one way

```
design system ─► platform kit ─► features ─► routes
shared ─► core ─► consumer | admin ─► apps
```

- `features/<a>` never imports `features/<b>`. Forty-one such imports grew in
  one project before anyone noticed. What two features need moves to the
  kit when the second consumer appears, never before.
- `forms/` and `components/` never import `@oppenheimer/frontend-*/react`,
  `@tanstack/react-query`, `@tanstack/react-router` or `expo-router`. The
  section, dialog or screen above them fetches and passes the result down.
- A route file composes: it imports `screens/`, `sections/` and `dialogs/`,
  reads `lib/` for a search schema, and stays under 120 lines. A 680-line route was a page that had moved
  in.
- An app imports exactly one product package. `apps/web` loading
  `@oppenheimer/frontend-admin` fails `pnpm arch`.
- The kit is imported by its package name (`@oppenheimer/frontend-web`), never by a
  path into its `src/`.
- An app never keeps a file the kit ships. `pnpm check:structure` compares
  basenames; the fix is to import it.

## The kit is concerns, not kinds, at its top level

`packages/frontend/web/src/<concern>/<kind>/` — `shell`, `auth`, `table`,
`layout`, `forms`, `theme`, `i18n`, `analytics`, `platform`, `roles`. Each
concern has an `index.ts`; a concern imports another only through it. The
concerns are layered (leaves → middle → top) and `pnpm arch` holds the order.
A concern that needs a product hook is a feature, not kit.

## Render rules

- **State lives in the lowest component that reads it.** A toggle belongs to
  the input, an open menu to the row, a draft to the field. A page holds only
  what two siblings share.
- **Subscribe at the leaf.** `useWatch` and `useFormState` take `control` and
  run in the component that shows the value; `select` narrows a query to what
  a row renders. A page-level `useWatch` re-rendered a whole register page,
  art panel included, on every keystroke.
- **One component per file.** Biome's `noNestedComponentDefinitions` is on.
- **An effect synchronises with something outside React, and says what.**
  A DOM listener, a subscription, a timer, an imperative library, the URL.
  Never deriving state, resetting on a prop change, chaining updates or
  fetching. It lives in a `hooks/` file with a one-line comment naming the
  system. Biome forbids `useEffect` anywhere else.
- **The React Compiler is on** in every app. No manual `useMemo`,
  `useCallback` or `memo` outside `hooks/` (where a library may need a stable
  identity). Biome forbids the import.
- **Contexts split by change rate.** A provider that holds a value and its
  setters exposes them so a toggle does not re-render the tree.

## Patterns agents get wrong

- Creating `components/<screen>/` at the app root. That is the pre-features
  layout; the checker rejects it.
- Naming a feature after the page (`settings`, `team`, `home`) instead of the
  module it renders.
- Adding a sub-folder inside `components/` when a feature grows. Split the
  feature, or promote to the kit.
- Writing a helper a second time instead of promoting the first.
- Putting `useWatch` or a query in the page and threading the value down.
- Reaching for `useEffect` to reset a form when a prop changes: React Hook
  Form's `values` option does it.
