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
for names, shapes and where a query is subscribed to, Biome for effects and
memo, and a `*-render.spec.tsx` for what a component costs. The Claude Code Stop hook
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

Placement is checked by every rule above this heading. These are about what a
component *does*. They were prose, and unchecked, and broken in two different
apps by code that satisfied every other rule in this file — so two things check
them now: `pnpm check:structure` reads where a query is subscribed to, and a
`*-render.spec.tsx` measures what a component costs.

A cost rule is not a size rule. This section briefly carried a line cap per kind
and it was the wrong check: a section that owns the query, the column factory,
six dialogs and the row menu passes at 149 lines, and what the cap actually
produced was files split to land under it. If a component is doing two jobs,
name the jobs and split *those*.

- **Fetch in the component that renders the result, not the one that owns the
  layout.** `sections/`, `dialogs/` and `screens/` may all call a query hook, so
  "the section above fetches and passes down" does not mean the screen. A query
  a screen subscribes to only so that one sibling below it can render the
  result belongs to that sibling.

  API keys were the worked example, and the screens are gone with the
  console's settings page, but the shape they were written against is why this
  rule exists: one screen held the token list *and* the permission catalog for
  a card and a table below it, and passed the card three props it forwarded
  straight to the form and read none of — so every settle of the token list, a
  create, a revoke, a window refocus, went through the create form and the
  picker beside it. What stands in the console now is the same rule from the
  other side: `SessionScreen` subscribes to the session it branches on and
  every branch below it renders that one result, and `SessionsSidebar`
  subscribes to the list because it draws the rows. Two siblings genuinely
  sharing one result passes; a query a screen holds for one sibling does not,
  and `pnpm check:structure` flags it, along with a prop a component only
  forwards.

- **A live input value is never a prop of a component that renders a list.**
  What a reader is typing is the field's state until it settles. Hand the list
  the settled value.

  `DataTable` took `search.value` as a controlled prop, so every character
  re-rendered the header, all eight rows, forty cells, eight row menus and the
  pager — for a query that was debounced anyway and had not been asked yet, and
  through a render-phase `setSelection` that ran again each time. `DataTableSearch`
  keeps the half-typed word now and calls `onChange` once per burst. If you need
  the same shape elsewhere, copy that: state in the field, debounce on the way
  out, settled value on the way back down.

- **State lives in the lowest component that reads it.** A toggle belongs to
  the input, an open menu to the row, a draft to the field. A page holds only
  what two siblings share. The exception worth knowing: a dialog opened from a
  `rowActions` menu cannot own its own open state, because that menu's content
  unmounts when the popup closes — those stay with the table, and cost it
  nothing.
- **Subscribe at the leaf.** `useWatch`, `useController` and `useFormState`
  take `control` and run in the component that shows the value; `select`
  narrows a query to what a row renders. A page-level `useWatch` re-rendered a
  whole register page, art panel included, on every keystroke. `PermissionPicker`
  held one flat `Scope[]` for eleven groups, so granting one re-rendered
  thirty-three toggles; each row takes its own field off the form now.
- **A component owns one job, and the job is named by what updates it.**
  `data-table.tsx` held the search field, the rows and the selection: three
  things on three different clocks, so each one's update redrew the other two.
  The split that matters is by clock, not by length — a keystroke, a page, a
  tick. When you cannot name the second job, there isn't one.
- **One component per file.** Biome's `noNestedComponentDefinitions` is on.
- **An effect synchronises with something outside React, and says what.**
  A DOM listener, a subscription, a timer, an imperative library, the URL.
  Never deriving state, resetting on a prop change, chaining updates or
  fetching. It lives in a `hooks/` file with a one-line comment naming the
  system. Biome forbids `useEffect` anywhere else.
- **The React Compiler is on** in every app. No manual `useMemo`,
  `useCallback` or `memo` outside `hooks/` (where a library may need a stable
  identity). Biome forbids the import.

  It is an optimisation, not the structure. It memoises a badly-shaped
  component into a clean profile — measured, it took the permission picker
  that rule was written against from thirty-three wasted renders per click to
  zero, and that screen's threaded query from one to zero — so a profiler will
  not show you any of this. That is why the two rules at the top of this list are checked rather
  than profiled, and why a `*-render.spec.tsx` runs with the compiler **off**.

  The converse is the trap: splitting a component into files does not isolate
  anything by itself. `DataTableRow` is its own file and a tick still redraws
  the page, because the setter that a tick calls lives in the shell above it.
  A split isolates an update only when the state that update writes moves with
  it.
- **A component whose cost is the point gets a render budget.** Name it
  `*-render.spec.tsx` and it runs in the `render-budget` vitest project, which
  does not enable the compiler. `data-table-render.spec.tsx` asserts that a
  keystroke renders no rows; `permission-picker-render.spec.tsx` that one click
  renders one row *and* that a keystroke in the catalog's search renders none.
  Budget every clock the component has, not the one you just fixed: the search
  field was added to that dialog with the query one component too high, and it
  was the missing burst assertion that let it through. Write the harness so the
  value feeds back the way the real caller feeds it, or the test passes on the
  shape it was meant to forbid.
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
- Putting `useWatch` or a query in the page and threading the value down. The
  page is where an agent lands first, and `/scaffold-feature` now hands it a
  screen *and* the section it composes for exactly that reason.
- Forwarding a prop a component never reads, so the thing below it can have a
  value the thing above it fetched.
- Letting a controlled input's value reach a component that maps over rows.
- Splitting a file to satisfy a number, and reporting the split as a fix.
- Passing a whole collection to a cell that needs one entry of it: a `Map`
  rebuilt each render invalidates the column factory that closes over it, and
  every cell with it.
- Reaching for `useEffect` to reset a form when a prop changes: React Hook
  Form's `values` option does it.
