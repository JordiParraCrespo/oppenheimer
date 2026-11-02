---
paths:
  - "apps/web/**/*"
  - "apps/web-showcase/**/*"
  - "packages/frontend/design-system/web/**/*"
  - "packages/frontend/web/**/*"
---

# Frontend UI Rules

Each rule below was written after finding the thing it forbids in this repo.
The linter is the check; this file is the list.

## Reach for the design system before writing markup

Before styling a `div`, check whether `@oppenheimer/design-system-web` already ships
it. Read `packages/frontend/design-system/web/src/index.ts` in full; its exports are
multi-line, so a grep for `export` misses most of them.

The table below holds the primitives every surface reaches for. The rest of
the catalog, one row per product surface (the composer, routines, Plan, pull
requests, the diff, the chat, bots, settings, the drag layer, charts), is
[`.agents/reference/frontend-ui-catalog.md`](../reference/frontend-ui-catalog.md):
read it too before building anything these rows do not name. Its rows are
rules of this section like these ones. `pnpm check:ui-catalog` keeps the two
tables honest (`scripts/ui-catalog.mjs`): a row whose Use column names a
component neither package exports publicly fails, and so does a
design-system module no Use column names, unless the module opens with
`// uncatalogued: <why>`. A new component lands with its row.

| Need                                  | Use                           | Not                                                   |
| ------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| A failure inside a screen that still draws its chrome (a form, a section, a dialog) | the kit's `ErrorAlert`: `error` + `fallback` to resolve a raw failure, `message` for one a form already resolved, `onDismiss` or `action` for its one button | a hand-built destructive `Alert`, a styled `div`, a bare `<p class="text-destructive">` |
| A failure that is the whole screen (the app cannot start, a route threw) | the kit's `ScreenFailure` | an `ErrorAlert` alone on an empty canvas, a hand-built `EmptyState` |
| A refusal about one field (a name the server rejected) | `FieldError` under the field | an `ErrorAlert` above the form |
| A section that draws a read's loading and failure — every such read in the console | the kit's `QueryState` around it: `Pending`, `Error`, and a `Data` whose child is the section that calls the product package's `useSuspense…` hook, whose `data` is never `undefined`; an empty answer is the section's own branch. A first failure lands on `Error`, with Try again (a function child takes `(error, retry)` and wires its own button to `retry`); a later one is the hook's `error`, drawn by the section as an `ErrorAlert` beside the data, with no retry (`pnpm check:structure` fails a Suspense read with no `ErrorAlert`, unless a `// A refetch that fails is not drawn here: <why>` comment says the failure changes nothing on screen — a form seeded once, facets beside a list that says it). The boundary sits in the parent that already renders the section, so no prop is threaded through a wrapper; two swapped by a URL view take a `key` each. A key the URL moves (a scope, a range, a filter, a page) is read through `useDeferredValue` (`useMemo` it in its `hooks/` file when it is an object), so the page on screen stays while the next one loads; several reads one section draws are one `useSuspenseQueries` hook in the product package, so they fetch side by side | a hand-written ternary ladder, `useQuery` with its own `isPending` branch, a `<Suspense>` or an `ErrorBoundary` of the feature's own, a second retry in the rows, two `useSuspense…` calls in one component (they fetch one after the other). A read that draws no loading or failure of its own (a count in a head, a name in a row, a snapshot read in a handler) and a picker chip's options (below) stay `useQuery` |
| A picker chip whose loading and failure show inside its popup | its `loading` and `failure` props — the chip stays on screen in every state, so it is not a `QueryState` site | a skeleton in the chip's place |
| "Are you sure?" before something that cannot be undone | the kit's `ConfirmDialog`, written the way its doc comment says (title, description, buttons, `ConfirmDialog.Option` for a choice) | a hand-built `Dialog` with its own Cancel, a `Checkbox` of the dialog's own |
| A button whose request is in flight | `Button pending pendingLabel`; `pending` locks that button only, so a sibling that must wait (the other provider, Deny beside Allow) takes `disabled` | `disabled={isPending}` and a ternary label |
| One "2 hours ago" line that has to keep moving | the kit's `RelativeTime`, which owns its tick | `useNow` in the row around it |
| A list whose rows all show an age | one `useNow` in the list, `now` handed to the rows, the words from `formatAge` / `common.relative` — one tick per list, not one timer per row | a `RelativeTime` per row |
| A success (when it earns one, below)  | the kit's `notifySuccess()`   | an `Alert`, an inline row, `toast.success()` directly |
| Field validation                      | `Field` + `FieldError`        | either of the above                                   |
| "Nothing here" / "still loading"      | `EmptyState`; a placeholder in the shape of what loads (below) | a centred paragraph, a grey slab of a guessed height |
| Picking one value out of a list the workspace grows | `ChipSelect` (searchable) | a `<select>` over the first page of an endpoint |
| Lifecycle state | `Badge` with `active` / `paused` / `ended` / `draft` | `secondary`, `outline`, `destructive` |
| Quiet metadata chip                   | `Badge variant="neutral"`     | `secondary`                                           |
| A dialog taller than the viewport | `DialogBody` around its middle | `overflow-y-auto` on `DialogContent` |

Why: an error callout was hand-rolled in nineteen places while `Alert` sat
exported, and empty and loading states in five while `EmptyState` was used by
one.

## Compose, don't configure

A component that draws several parts takes them as children, and the caller
puts them where they go. The design system's `EmptyState.Header`, the kit's
`QueryState.Pending` and `PageHeader`'s parts are the shape; a component that
grows a prop for each part it might draw, or a boolean for each way it might
look, is the shape this rule forbids.

- **A part the caller draws is a child or a compound part.** A header, an
  empty state, a placeholder, a row of actions: `<QueryState.Pending>…</…>`,
  never `empty={{ when, show }}`, `header={{ title, action }}` or a
  `renderFooter={() => …}` that receives nothing.
- **A boolean that changes what a component is, is a second component or a
  part left out.** `compact`, `isEditing`, `showActions`, `withFooter`,
  `variant="readonly"` that hides half the markup: the caller composes the
  version it wants, or picks an explicit variant component. A
  boolean that reports the state of the same thing (`pending`, `disabled`,
  `open`, `active`) is not a mode, and stays a prop.
- **A function child hands down data the caller does not have.**
  `QueryState.Error` gets the failure and its retry, `RelativeTime` the
  words, `DiffView`'s `renderAnnotation` the annotation.
  A render prop with nothing to hand down is a slot, and a slot is a child.
- **A read that can be switched off is a section rendered conditionally.**
  A query waiting on an input that may not exist yet (`skipToken`, a caller's
  `enabled`) is drawn by a section the parent renders only once the input
  does: `{id ? <AutomationDetail id={id} /> : <PickOne />}`, with `id: string`
  all the way down. A Suspense read cannot be switched off: its section is
  the one the parent renders once the input exists.
- **A compound's parts meet through the root's context**, never through props
  the caller threads from one part to the next. `QueryState`'s root decides
  the rung once and each slot reads it. In the kit and the design system the
  parts live in one file as `Root.Part` (`Object.assign`); an app keeps one
  component per file, so a compound a feature needs is the kit's, and a
  feature that grows one promotes it.

Why: `QueryState` took its rungs as `pending`, `errorFallback`,
`errorClassName`, `renderError` and `empty={{ when, show }}`, and each new
need (a class on the failure, a failure said another way, a failure kept beside
the data) was one more prop. The caller could not place a rung, and a reader had to
learn each prop to read a section. As slots, a section reads as the states it
draws, in the order it draws them. `/frontend-audit` reports a break as `U6`.

## A success toasts when the reader could miss it

A failure stays inline, next to what the reader has to fix. A success toasts,
through the kit's `notifySuccess('<toasts key>', values)`, only when its result
is not where the reader is looking: out of sight, off the page, or easy to miss
in a long list. When the screen navigates to the result, shows a "done" view,
or changes the very control that was pressed, it says nothing more. A form
whose save row already says "Saved" beside the button keeps that and does not
also toast.

## A picker over a list the workspace grows is an autocomplete

| The options are | Use |
| --- | --- |
| Two to four views of one pane | `SegmentedControl` |
| Fixed and short, known at build time, inside a menu | `DropdownMenuRadioGroup` |
| A scope chip on the console (project, host, branch, agent) | `ChipSelect`, always searchable; `variant="tab"` on New session's `ComposerChoices` row and over its box |
| A labelled pick in the routine editor | `FieldSelect` |
| Several repositories, each on its own branch | `RepositorySelect` |
| A filter over a list rather than a field | `DropdownMenuSub` per facet, `DropdownMenuRadioGroup` inside (the sessions filter menu) |

Every picker filters as you type
([the design system's notes](../../packages/frontend/design-system/AGENTS.md)).
The threshold is where the filtering happens: if the option list comes from
an endpoint that can hold more than one page, the search is the API's to
answer. Give `ChipSelect` `onQueryChange`, point it at the query that fetches
the options (debounced there) and pass `loading` while it is in flight; it then
shows what it is given and filters nothing itself. Without `onQueryChange` it
filters the options in the browser, which is right for a list that always
arrives whole (the agents, the efforts, the permission levels). Why: two pickers
fed `{ limit: 100 }` could not reach any record past the hundredth.

In a form, every one of these is wired through a `Controller`
([`forms.md`](./forms.md)).

## A tall modal scrolls in its body, never in its card

`DialogContent` is a flex column capped at the viewport and does not scroll.
Put the middle of a long dialog inside `DialogBody`; hero, header and footer
stay pinned as siblings. Never `max-h-… overflow-y-auto` on `DialogContent`,
and never cap a list's height inside a dialog that already scrolls: one dialog
gets one scrollbar. Below 520px of viewport height `dialog.tsx` lets the whole
card scroll instead; the two breakpoints are complements, leave them so.

## A list's query lives in the URL

The runs list is the worked example (`features/automations/lib/runs-search.ts`,
`hooks/use-runs-filters.ts`):

- Search, filters, sort and page live in the URL, as the route's search schema
  (the `/tanstack-routing` skill), never in `useState`; the list resets to page
  one when it narrows, and a default is no key.
- **Search and facets are the server's job.** Send the query and the facet
  ids in the request; never filter one page in the browser to answer a
  search box. A search matches everything the row shows: widen the endpoint
  rather than narrow the list.
- **The field owns the half-typed word.** It debounces once on the way out
  and hands the list the settled value; nothing else debounces, and a live
  value never reaches the rows (the render rules in
  [`frontend-architecture.md`](./frontend-architecture.md)).
- Every route that shows the list declares its schema; a key a route does
  not name is dropped, so a filter lives on the routes that draw it.

Build those pieces in the feature that needs them and promote them to the kit
when a second list does.

## A gated nav row's permissions are the endpoint's own

A row in `apps/web/src/lib/nav.ts` that needs a permission takes its `policies`
from `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`, keyed by the endpoint
the screen reads — `policies: ENDPOINT_POLICIES['GET /tokens']`. Never a literal
`[{ action, subject }]`: that is a second copy of a rule the server already
owns, and `apps/api/src/auth/__tests__/endpoint-policies.spec.ts` holds the
controller to the catalog entry, not to your copy. Why: a row declared
`policies: []` while its endpoint demanded `read Member`, so members got a link
to a 403.

The route string lives in the app that mounts it, and another client may mount
the same endpoints under different URLs, so there is no shared route list to
look one up in — the nav row names the endpoint directly. Today both
`apps/web` rows are ungated (`policies: []`), so the first gated row is still
to be written.

An org-less account goes to `/onboarding` from the `_authenticated` layout.

## One colour vocabulary: the brand primitives

In `apps/web`, use the semantic tokens from `globals.css`: `text-fg`,
`text-fg-muted`, `text-fg-subtle`, `text-link`, `bg-canvas`, `bg-surface-*`,
`bg-control-*`, `border-border` / `border-border-subtle`, `--accent-*`,
`--status-*`. The older `text-ink-*` and `bg-surface-*` aliases still resolve
for the screens not yet ported; new code takes the semantic names. Not
shadcn's aliases (`text-muted-foreground`, `bg-muted`, `text-foreground`), not
a raw hex, not a stock Tailwind colour (`text-amber-600`), and no `dark:`
colour overrides: the tokens already invert.
A colour genuinely outside the palette becomes a named token in
`packages/frontend/design-system/web/src/styles/globals.css` with a comment saying why.

Primitives in `packages/frontend/design-system/web` are the exception on `dark:`. A
variant that is not a colour swap (`avatar.tsx` switches blend modes)
belongs there and nowhere else.

## The design-system linter enforces the two rules above

`pnpm lint:design` runs `@shadcn/lint` through oxlint; `apps/web` and
`apps/web-showcase` point at the config the design system ships
(`packages/frontend/design-system/web/oxlint.design.json`).
Biome owns correctness; oxlint's own categories are off.

- `no-raw-colors` / `no-unknown-classes`: a class the theme does not declare.
  Always a bug, Tailwind generates nothing for it.
- `no-arbitrary-values`: `size-[17px]` when `size-4.25` is on the scale.
- `no-restyle`: spacing, colour, shape or typography overriding a component
  that owns it. Layout classes and icon colours are allowed.
- `no-inline-styles`: a `style` attribute. Data-driven values (a column width,
  a role colour from the database) get a line-level disable, not a rewrite.
- `require-static-classes` is off: shared class constants are the convention.

Rules sit at `warn` while inherited findings are worked off. Promote a rule to
`error` in `oxlint.design.json` once its count reaches zero; never lower one
back to `warn` to land a change. Known false positive before promoting
`no-raw-colors`: `shadow-panel` is read as a colour. The linter's grammar reads every font
size the theme adds (`text-operate`, `text-h2`, `text-micro`…) as a colour
too; those are an `allow` list on `no-raw-colors` in `oxlint.design.json`,
kept in step with `FONT_SIZES` in the design system's `cn()`.

## The design system is its folder

`packages/frontend/design-system/web/src/components/` is the public set: every
file there is re-exported from `src/index.ts` (`apps/web` imports from the root
only) and shown on the showcase under the `toc.ts` item that lists it.
`src/internal/` holds the building blocks only those components import.
`pnpm --filter @oppenheimer/design-system-web test` holds the three to each
other. When the last caller of a component goes, delete it in the same
change.

## Where code goes

Placement is [`frontend-architecture.md`](./frontend-architecture.md): a
feature per module with kind directories, the platform kit for what sits below
the routes, the design system for primitives. This file is about what the markup
looks like once it is in the right place.

- **Dates.** Format through the kit's `dateFormatter` with the locale from
  `useLocale()`. Never `toLocaleDateString()` without a locale, never
  `i18n.language` or a bare `i18n.resolvedLanguage`.
- **`Intl` formatters** are expensive and pure; `dateFormatter()` caches them.
  Never construct one in render.

## Never ship a placeholder number

If the real value is not available, render nothing (or, while its read is
pending, a placeholder bar that keeps its width). A component names the
total it wants and the shell resolves it from a query (`useNavCounts` in
`app-sidebar.tsx`); an unresolved total is `undefined` and renders no badge.

## A placeholder has the shape of what replaces it

A `QueryState.Pending` draws the page that is coming, not a grey box: when
the data lands, nothing on screen moves except the bars turning into words.
The pull-request feature (`apps/web/src/features/pull-requests/components/*-skeleton.tsx`)
is the reference.

- **Draw inside the real container.** The placeholder renders the same
  `Card`, `Panel`, `SettingsGroup`, `PullRequestTable` the data renders in,
  so corners, borders, widths and container breakpoints come for free. A
  row's placeholder is the design system's `<Row>Skeleton` beside the row,
  on the row's own grid (`PullRequestRowSkeleton`), or the row itself with
  its data left out (`PersonRow` with no `login`): one owner for the shape.
- **Write what is static.** Column heads, section and panel titles, a page
  title that reads only the URL, a tab's label: real text, not bars. Only
  what the read answers is a placeholder. A header that needs no data sits
  outside the `QueryState` (or is drawn by both slots) so it never blinks.
- **A bar per line, at the line's height.** Each `Skeleton` sits in a box the
  height of the text line, control or row it stands for (`h-5` for a body
  line, the row's `min-h-*`), with widths that vary like text. Count rows as
  the list usually holds, not a full page.
- **Never a value the data has not given.** A count, a total or a wait not
  answered yet is a small inline bar, or nothing; never `0`, `—` or "none"
  (see "Never ship a placeholder number"). A count slot keeps its width, so
  the tabs or chips around it do not move when it lands.
- **The shape that is coming.** When the loaded view can be one of two
  shapes (a terminal or the panel that starts one), choose from what is
  already cached; when nothing tells, draw the quieter one.
- **Quiet for assistive technology.** `Skeleton` is `aria-hidden` and pulses
  only under `motion-safe`; the placeholder's root carries `aria-busy` and the
  kit's `<LoadingStatus />`, the one "Loading…" a screen reader hears.
- **A design-system record owns its placeholder.** When the row or card a list
  draws is a design-system component, its placeholder sits beside it in the
  same file on the same frame (`HostCardSkeleton` shares `HostCard`'s
  `FRAME`; `PullRequestRowSkeleton` its row's grid), so the two cannot drift.
- **Named and placed.** More than a bar or two is a `<View>Skeleton` in the
  feature's `components/` (or a `sections/` one when it must read a cache to
  pick its shape), one component per file.

`pnpm check:structure` fails a `QueryState.Pending` that holds nothing but
`Skeleton`s with a slab among them: a block 64px tall or more, or one that
fills its frame (`scripts/skeleton-shape.mjs`). A pane that really is one block
until it answers says so inside the slot,
`{/* A block stands in here: <why> */}`. The thirteen files that held slabs when
the check landed were `SLAB_DEBT` in `scripts/skeleton-slab-debt.mjs`, each
held to its count; all are redrawn and the list is empty. Nothing is added
to it: a new slab is fixed where it is written. Whether a named placeholder has the right shape is
`/frontend-audit`'s `U7`. Before a pull request, photograph each placeholder
held beside its loaded page (`/local-stack`, "Show a visual change").

Why: every placeholder in Pull requests was one slab of a guessed height (a
320px block for a 650px queue, 384px for a 1,300px page, no rail beside the
description), the queue header said "0 ready" while it loaded, and each page
jumped when its data arrived.

## Translate everything the user can read, including downloads

Every user-facing string goes through `t()`, CSV headers and exported enum
values included. Machine-readable columns (an ISO-8601 timestamp) are the
exception and say so. When a key stops being used, delete it from every locale
in the same change.

## Every product surface gets an end-to-end spec

A screen wired to the API needs a spec in `e2e/tests/web/`. Conventions are in
[`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) and
[`e2e/README.md`](../../e2e/README.md).

## Every visual change is photographed

A change that alters what the console shows is taken light and dark on the
local stack, looked at, shown to the user and listed under `## Screenshots`
in its pull request: the `local-stack` skill's "Show a visual change" step
(`pnpm screens <route>...`). A component in the design system
or the kit is photographed on a console route that renders it. The hook
`.agents/hooks/screenshot-guard.mjs` refuses to push the branch, or open or
update its pull request, until the pictures are of the code as it is
(`.agents/hooks/visual-change.mjs` defines what counts; `.claude/settings.json`
says when the guard runs).

## Dead code

Biome's `noUnusedImports` cannot see an exported component nothing imports.
When you delete the last caller of something, delete the thing.
