---
paths:
  - "apps/web/**/*"
  - "packages/frontend/**/*"
---

# Frontend Architecture Rules

Where a thing goes on the frontend, and what it may import. Every rule here is
checked: dependency-cruiser (`pnpm arch`) for imports, `pnpm check:structure`
for names, shapes and where a query is subscribed to, Biome for effects and
memo, Biome plugins in `biome-plugins/` for query keys, `skipToken` and
mutation cache updates (the rules are
[`apps/docs/docs/architecture/query-keys.md`](../../apps/docs/docs/architecture/query-keys.md)),
`pnpm check:unused` (knip) for code nothing reaches, and a `*-render.spec.tsx`
for what a component costs. The Claude Code Stop hook runs dependency-cruiser
and `pnpm check:structure`; CI runs every check. The layer model and the cookbooks are in
[`packages/frontend/ARCHITECTURE.md`](../../packages/frontend/ARCHITECTURE.md)
and `apps/web/ARCHITECTURE.md`; `/scaffold-feature` produces the shape.

Each rule below was written after finding the thing it forbids in a project
built from this starter.

## Placement: four questions, in order

| Question | Answer | Goes in |
| --- | --- | --- |
| Is it logic (an entity, a repository, a service, a query hook)? | kernel: session, users, settings, anything any app needs | `packages/frontend/core` |
| | the product's domain and its account chrome | `packages/frontend/consumer` |
| Is it UI or platform glue below the routes that needs no product hook? | | `packages/frontend/web` |
| Is it a design-system primitive? | | `packages/frontend/design-system/web` |
| Everything else | | `apps/web/src/features/<module>/<kind>/` |

Two cells are never filled: logic in the platform kit (it would be tied to one
platform) and UI in a product package (it would need `react-dom`).
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
shared ─► core ─► consumer ─► apps/web
```

- `features/<a>` never imports `features/<b>`. Forty-one such imports grew in
  one project before anyone noticed. What two features need moves to the
  kit when the second consumer appears, never before.
- `forms/` and `components/` never import `@oppenheimer/frontend-*/react`,
  `@tanstack/react-query` or `@tanstack/react-router`. The
  section, dialog or screen above them fetches and passes the result down.
- A route file composes: it imports `screens/`, `sections/` and `dialogs/`,
  reads `lib/` for a search schema, and stays under 120 lines. A 680-line route was a page that had moved
  in.
- The kernel never imports the product package, and the kit imports only the
  kernel. `pnpm arch` fails either way.
- A feature never imports React Query outside its tests
  (`features-query-through-the-product`); it reads and writes through the
  product package's hooks.
- `src/providers/` imports a feature's `dialogs/` and nothing else of a
  feature (`providers-mount-dialogs`).
- The kit is imported by its package name (`@oppenheimer/frontend-web`), never by a
  path into its `src/`.
- The API is called through `@oppenheimer/api-client`'s root (`heyApiSdk`),
  from a product package's repository, never a path into the client's `src/`
  (`one-api-client`). A function is named after the API slice's use case
  (`FindHostsHttpController` is `findHosts`); the API's operation-id factory
  refuses two handlers on one name, so there is never a `list2` to guess at.
- An app never keeps a file the kit ships. `pnpm check:structure` compares
  basenames; the fix is to import it.

## The kit is concerns, not kinds, at its top level

`packages/frontend/web/src/<concern>/<kind>/` — `shell`, `auth`,
`layout`, `forms`, `theme`, `i18n`, `analytics`, `platform`,
`pairing`. A concern is named after what it does, never after a product
module. Each
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

  The kit's `DataTable` (deleted since, unmounted) took `search.value` as a
  controlled prop, so every character re-rendered the header, all eight rows,
  forty cells, eight row menus and the pager — for a query that was debounced
  anyway and had not been asked yet, and through a render-phase `setSelection`
  that ran again each time. The fix was a search field that kept the half-typed
  word and called `onChange` once per burst. Copy that shape: state in the
  field, debounce on the way out, settled value on the way back down.

- **State lives in the lowest component that reads it.** A toggle belongs to
  the input, an open menu to the row, a draft to the field. A page holds only
  what two siblings share. The exception worth knowing: a dialog opened from a
  `rowActions` menu cannot own its own open state, because that menu's content
  unmounts when the popup closes — those stay with the list, and cost it
  nothing.
- **Subscribe at the leaf.** `useWatch`, `useController` and `useFormState`
  take `control` and run in the component that shows the value; `select`
  narrows a query to what a row renders. A page-level `useWatch` re-rendered a
  whole register page, art panel included, on every keystroke. `PermissionPicker`
  held one flat `Scope[]` for eleven groups, so granting one re-rendered
  thirty-three toggles; each row takes its own field off the form now.
- **A component owns one job, and the job is named by what updates it.**
  The old `data-table.tsx` held the search field, the rows and the selection:
  three things on three different clocks, so each one's update redrew the other
  two.
  The split that matters is by clock, not by length — a keystroke, a page, a
  tick. When you cannot name the second job, there isn't one.
- **One component per file** in an app. Biome's `noNestedComponentDefinitions`
  catches one declared inside another; `pnpm check:structure` catches two
  declared side by side, which Biome does not see. The kit is exempt: a
  primitives file there exports a family meant to be read together.
- **An effect synchronises with something outside React, and says what.**
  A DOM listener, a subscription, a timer, an imperative library, the URL.
  Never deriving state, resetting on a prop change, chaining updates or
  fetching. It lives in a `hooks/` file with a one-line comment naming the
  system. Biome forbids `useEffect` anywhere else.
- **The React Compiler is on** in the app. No manual `useMemo`,
  `useCallback` or `memo` outside `hooks/` (where a library may need a stable
  identity). Biome forbids the import.

  It is an optimisation, not the structure. It memoises a badly-shaped
  component into a clean profile — measured, it took the permission picker
  that rule was written against from thirty-three wasted renders per click to
  zero, and that screen's threaded query from one to zero — so a profiler will
  not show you any of this. That is why the two rules at the top of this list are checked rather
  than profiled, and why a `*-render.spec.tsx` runs with the compiler **off**.

  The converse is the trap: splitting a component into files does not isolate
  anything by itself. The old `DataTableRow` was its own file and a tick still
  redrew the page, because the setter that a tick calls lived in the shell above
  it.
  A split isolates an update only when the state that update writes moves with
  it.

  The compiler also gives up silently. The build runs its oxc port with
  `panicThreshold: 'none'`, so a component it cannot compile (a ref written
  during render, a default parameter that is an arrow function, a `throw`
  inside `try`, react-hook-form's `watch()`) ships unmemoised and nothing
  says so. `pnpm check:compiler` lists every one.
- **A component whose cost is the point gets a render budget.** Name it
  `*-render.spec.tsx` and it runs in the `render-budget` vitest project, which
  does not enable the compiler. `new-session-composer-render.spec.tsx` asserts
  that a keystroke in the composer re-renders none of the chips beside it.
  Budget every clock the component has, not the one you just fixed: a search
  field was once added to a permission dialog with the query one component too high, and it
  was the missing burst assertion that let it through. Write the harness so the
  value feeds back the way the real caller feeds it, or the test passes on the
  shape it was meant to forbid.
- **Contexts split by change rate.** A provider that holds a value and its
  setters exposes them so a toggle does not re-render the tree.

  A form whose fields are spread over several sections is the common case, and
  the answer is a store behind a context whose value never changes: New
  session's draft is a React Hook Form store (`use-new-session-form.ts`), the
  context carries the form object — one identity for its whole life, unlike
  `FormProvider`, which spreads the methods into a new object on every render —
  and each chip is a section that binds its own field with `useController` or
  `useWatch` and fetches the list it draws. The section that owns the store
  reads no field, so it renders once; `new-session-form-render.spec.tsx`
  asserts that a pick renders only the chip that was picked.
- **Generic React hooks live in the design system's `hooks/`.** `useControlled`
  (the `value` / `defaultValue` / `onChange` triple), `useDebouncedValue`,
  `useDebouncedCallback` and `useNow` are exported from `@oppenheimer/design-system-web`, the
  lowest React package the kit, the apps and the design system's own
  components all share. A hook there knows nothing of the product or of a
  query; one that does belongs in a product package or a feature's `hooks/`.
  Before writing a timer, a controlled/uncontrolled pair or a latest-ref,
  check that directory.

- **A clock is an input, never a read in render.** `Date.now()` or `new Date()`
  inside render is cached by the compiler on the inputs it can see, so an age
  stops moving. Take the time from `useNow(interval)` in the lowest component
  that draws it, and hand a one-second tick to a leaf of its own — the
  pairing countdown and the provisioning clock are elements in their parent's
  slot, so a tick re-renders a line of text and not the dialog around it.
- **Queries share entities across refetches.** The entities are classes,
  which TanStack Query's default structural sharing does not look into, so
  without `shareEntities` every refetch hands every reader a new object per
  row. A query hook in a frontend package's `src/react/` calls `useQuery` /
  `useQueries` from `@oppenheimer/frontend-core/react`, which apply it (a query
  that must not share passes `structuralSharing: false`); `pnpm
  check:structure` fences TanStack's own two out of those files. A list hook
  takes a narrowing `select`, and a read that only happens in an event handler
  uses the module's `use…Snapshot()` rather than subscribing.

- **A decision about time is config; a unit is not.** How long data stays
  fresh, how often a clock on screen moves, how long input waits, how many
  times a request is retried: a value in `CORE_CONFIG`
  (`@oppenheimer/frontend-core/config`) when any product lives with it, or in
  `CONSUMER_CONFIG` (`@oppenheimer/frontend-consumer/config`) when it is the
  console's, because the kernel never names a product. Polls are `LIVE_POLL`,
  below. A unit (`MINUTE = 60_000`), a protocol fact (an escape code, the API's
  page maximum) and a small value with one reader that is part of how that
  code works (a "Copied" flash, a resize settle) stay a constant where they
  are used.

- **Polling is one policy.** `LIVE_POLL` in the product package
  (`src/react/live-poll.ts`) owns every poll: its interval and whether it
  keeps running while the tab is hidden. A package hook spreads
  `usePollWhile(kind, queryKey, active)` and says only when the thing it
  watches is still moving; a feature never sets `refetchInterval` and asks
  for the hook that already polls (`useHostPresence`). A poll that watches something finish keeps running on
  a hidden tab, because that is the tab the reader leaves while it runs;
  presence, which never settles, does not. `pnpm check:structure` fails a
  `refetchInterval` anywhere but that file. The query key is how a poll
  meets the workspace event stream: while the stream is live, a poll whose
  key its coverage table (`workspace-events.ts`) says it carries stands
  down, and polls again the moment it drops. A new event goes in that
  table, never in the hook.

## The page frame is the shell's

A console page does not draw its own ground, scroll or measure. The route
declares the measure as `staticData.pane` — `narrow` (the default), `wide`
(a table) or `board` (Plan's columns) — on the layout route of its subtree
where it has one (`plan.tsx`, `automations.tsx`, `pulls.tsx`, which render
nothing but their `Outlet`), and `AppShell` draws the design system's
`EditorPage` around it: the ground, the one scroll, the gutter. A screen renders content
only, from a plain `flex flex-col` with its own gap. A child that has to
reach the frame's edge — the task board's sideways scroller — bleeds
through `--page-gutter` instead of restating the gutter's width. `full` is
for a screen whose box is the pane (the terminal, New session's drop zone,
a pull request's bar over its diff). The ground under every pane is the
export's grey, `canvas-recessed`, painted by the shell's column; white
cards float on it with no border of their own. Settings has its own shell
on the same grey.

`pnpm check:structure` fails an app file outside `features/public/` that
paints `bg-canvas*` or `bg-background`, or renders `EditorPage` or
`EditorPageBody`.

## Routing is its own skill

`apps/web` routes with TanStack Router, where a file's
name decides both its URL and the layout chain that renders it. Before adding,
moving or guarding a route — or touching `routeTree.gen.ts`, `beforeLoad`,
`validateSearch` or route `staticData` — read the `/tanstack-routing` skill
(`.agents/skills/tanstack-routing/`). It carries the file-name table, the
guard and search-param rules, and the check that proves a restructure did not
change a URL.

## Nothing is kept for later

`pnpm check:unused` runs knip (`knip.json`) over `apps/web` and the kernel,
product and kit packages, and fails on an unused file, dependency or export.

- An export is checked **through its package's barrel**, the kernel's
  included: a package exports what the console imports and nothing else. A
  hook, key factory or error catalog only the package itself uses stays in it,
  unexported. Keeping something "for a later screen" is the shape this check
  exists to stop — the later screen re-exports it.
- A kernel export that is a documented contract with no caller yet (the
  flags rule's `useFeatureFlag`, the analytics doc's `useCaptureEvent`) is
  tagged `/** @public <why> */` on its line in the barrel. One symbol, one
  reason; never a package or a file.
- Exported types are not checked: they cost nothing at run time and are the
  vocabulary a caller annotates with.
- Knip does not see class members. When you delete the last caller of a hook,
  delete the service and repository methods only it reached, and the error
  codes only they raised.

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
- Renaming a route file without checking the URL it produces. In file-based
  routing a rename is a URL change; `/tanstack-routing` has the diff that
  catches it.
- Putting two opposite guards on one shared layout route instead of giving
  each subtree a pathless child that carries its own.
