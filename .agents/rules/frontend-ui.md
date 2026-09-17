---
paths:
  - "apps/web/**/*"
  - "apps/admin-web/**/*"
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

| Need                                  | Use                           | Not                                                   |
| ------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| Whole-form or whole-page failure      | `Alert variant="destructive"` | a styled `div`, a bare `<p class="text-destructive">` |
| A success                             | `toast.success()`             | an `Alert`, an inline row                             |
| Field validation                      | `Field` + `FieldError`        | either of the above                                   |
| "Nothing here" / "still loading"      | `EmptyState`, `Skeleton`      | a centred paragraph                                   |
| A list with paging, search or filters (`apps/web`) | `DataTable` | `Table` primitives directly |
| Picking one value out of a list the workspace grows | `Combobox` | `Select` over the first page of an endpoint |
| Lifecycle state | `Badge` with `active` / `paused` / `ended` / `draft` | `secondary`, `outline`, `destructive` |
| Quiet metadata chip                   | `Badge variant="neutral"`     | `secondary`                                           |
| A dialog taller than the viewport | `DialogBody` around its middle | `overflow-y-auto` on `DialogContent` |

Why: an error callout was hand-rolled in nineteen places while `Alert` sat
exported, empty and loading states in five while `EmptyState` was used by one,
and a whole second table was built beside `DataTable`.

`DataTable` ships in `@oppenheimer/frontend-web`, so that row is the apps' only;
`apps/web-showcase` builds on the `Table` primitives. In the apps every table
goes through `DataTable`, and a direct `Table` import needs a comment saying
why. Everything placed in the table's header bar takes
`TABLE_HEADER_CONTROL_SIZE` from the kit; a heading or description goes above
the table (`GroupHeading`), never inside the bar.

## A picker over a list the workspace grows is an autocomplete

| The options are | Use |
| --- | --- |
| Fixed and short, known at build time (a stage, a status) | `Select` |
| A workspace list, one value, in a labelled field | `Combobox` |
| Thousands, several values, fetched per keystroke | `AsyncMultiSelect` |
| A toolbar filter rather than a field | `SelectMenu` (one) / `FilterMenu` (many) |

The threshold: if the option list is fetched from an endpoint, it is an
autocomplete. `Combobox` is a form control (`Field` + `FieldLabel` +
`Combobox`, wired through a `Controller`, see [`forms.md`](./forms.md)), with
`clearLabel` for the "Unassigned" row. Point `onQueryChange` at the query that
fetches the options so the search is the API's to answer. Why: two `Select`s
fed `{ limit: 100 }` could not reach any record past the hundredth.

## A tall modal scrolls in its body, never in its card

`DialogContent` is a flex column capped at the viewport and does not scroll.
Put the middle of a long dialog inside `DialogBody`; hero, header and footer
stay pinned as siblings. Never `max-h-… overflow-y-auto` on `DialogContent`,
and never cap a list's height inside a dialog that already scrolls: one dialog
gets one scrollbar. Below 520px of viewport height `dialog.tsx` lets the whole
card scroll instead; the two breakpoints are complements, leave them so.

## A table's query lives in the URL

Search, filters, sort and page go through the kit's `useTableQuery` (nuqs).
Never `useState` for any of the four. The hook resets to page one when the
list narrows and debounces the URL write.

- **Search is the server's job, and debounced.** Pass the debounced
  `searchQuery` to the request and the immediate `search` to the input. No
  screen filters rows in the browser to answer a search box.
- **A search matches everything the row shows.** Widen the endpoint rather
  than narrow the table.
- **A facet is the server's job too.** Send ids in the request (`?roleIds=`);
  `paginateRows` slices what it is given, so a browser-side facet only trims
  the rows on screen. Rows the endpoint does not know about (pending
  invitations in the members table) are dropped by a facet, not left in.
- Two tables on one route each take a `prefix`, or they fight over `?q=`.
- A route with `validateSearch` must carry unknown keys through, or it deletes
  what the table wrote on the next navigation. `/settings` is the example.
- A list the server hands over whole is sliced with the kit's `paginateRows`.

## A gated nav row's permissions are the endpoint's own

A row in an app's `lib/nav.ts` that needs a permission takes its `policies`
from `ENDPOINT_POLICIES` in `@oppenheimer/shared/permissions`, keyed by the endpoint
the screen reads — `policies: ENDPOINT_POLICIES['/tokens']`. Never a literal
`[{ action, subject }]`: that is a second copy of a rule the server already
owns, and `apps/api/src/auth/__tests__/endpoint-policies.spec.ts` holds the
controller to the catalog entry, not to your copy. Why: a row declared
`policies: []` while its endpoint demanded `read Member`, so members got a link
to a 403.

The route string lives in the app that mounts it. `apps/web` and
`apps/admin-web` have different URLs over the same endpoints, and `apps/mobile`
different again, so there is no shared route list to look one up in — the nav
row names the endpoint directly. Today both `apps/web` rows are ungated
(`policies: []`) and `apps/admin-web` sits behind one `canAccessControlPlane`
gate, so the first gated row is still to be written.

A screen the product picks for the reader (the dashboard `/` redirects to)
checks its own policies through `useLandingRoute` and answers `null` rather
than bouncing between errors. An org-less account goes to `/onboarding` from
the `_authenticated` layout.

## One colour vocabulary: the brand primitives

In the apps, use the semantic tokens from `globals.css`: `text-fg`,
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
variant that is not a colour swap (`avatar.tsx` switches blend modes,
`chart.tsx` selects the dark chart theme) belongs there and nowhere else.

## The design-system linter enforces the two rules above

`pnpm lint:design` runs `@shadcn/lint` through oxlint; each app points at the
config its design system ships (`packages/frontend/design-system/{web,mobile}/oxlint.design.json`).
Biome owns correctness; oxlint's own categories are off.

- `no-raw-colors` / `no-unknown-classes`: a class the theme does not declare.
  Always a bug, Tailwind generates nothing for it.
- `no-arbitrary-values`: `size-[17px]` when `size-4.25` is on the scale.
- `no-restyle`: spacing, colour, shape or typography overriding a component
  that owns it. Layout classes and icon colours are allowed.
- `no-inline-styles`: a `style` attribute. Data-driven values (a column width,
  a role colour from the database) get a line-level disable, not a rewrite.
- `require-static-classes` is off: shared class constants are the convention.
- Mobile runs the same rules minus `no-unknown-classes` and `no-inline-styles`
  (Tailwind 3 and React Native's `style` prop). `apps/mobile-showcase` lints
  `app` and `lib` only.

Rules sit at `warn` while inherited findings are worked off. Promote a rule to
`error` in `oxlint.design.json` once its count reaches zero; never lower one
back to `warn` to land a change. Known false positive before promoting
`no-raw-colors`: `shadow-panel` is read as a colour.

## Every component export belongs in the barrel

`packages/frontend/design-system/web/src/index.ts` re-exports everything a file in
`src/components/` exports; `pnpm --filter @oppenheimer/design-system-web test` fails
otherwise. `apps/web` imports components from the root only, so a missing
barrel entry is a component that does not exist: `Breadcrumb` shipped, styled
and building, and a detail page hand-rolled one. Something internal is not
exported from its own module either.

## Where code goes

Placement is [`frontend-architecture.md`](./frontend-architecture.md): a
feature per module with kind directories, the platform kit for what both apps
share, the design system for primitives. This file is about what the markup
looks like once it is in the right place.

- **Dates.** Format through the kit's `dateFormatter` with the locale from
  `useLocale()`. Never `toLocaleDateString()` without a locale, never
  `i18n.language` or a bare `i18n.resolvedLanguage`.
- **`Intl` formatters** are expensive and pure; `dateFormatter()` caches them.
  Never construct one in render.

## Never ship a placeholder number

If the real value is not available, render nothing. A component names the
total it wants and the shell resolves it from a query (`useNavCounts` in
`app-sidebar.tsx`); an unresolved total is `undefined` and renders no badge.

## Translate everything the user can read, including downloads

Every user-facing string goes through `t()`, CSV headers and exported enum
values included. Machine-readable columns (an ISO-8601 timestamp) are the
exception and say so. When a key stops being used, delete it from every locale
in the same change.

## Every product surface gets an end-to-end spec

A screen wired to the API needs a spec in `e2e/tests/web/`. Conventions are in
[`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) and
[`e2e/README.md`](../../e2e/README.md).

## Dead code

Biome's `noUnusedImports` cannot see an exported component nothing imports.
When you delete the last caller of something, delete the thing.
