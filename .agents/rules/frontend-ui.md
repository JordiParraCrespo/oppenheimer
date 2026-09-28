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

| Need                                  | Use                           | Not                                                   |
| ------------------------------------- | ----------------------------- | ----------------------------------------------------- |
| Whole-form or whole-page failure      | `Alert variant="destructive"` | a styled `div`, a bare `<p class="text-destructive">` |
| A success                             | `toast.success()`             | an `Alert`, an inline row                             |
| Field validation                      | `Field` + `FieldError`        | either of the above                                   |
| "Nothing here" / "still loading"      | `EmptyState`, `Skeleton`      | a centred paragraph                                   |
| Picking one value out of a list the workspace grows | `ChipSelect` (searchable) | a `<select>` over the first page of an endpoint |
| Lifecycle state | `Badge` with `active` / `paused` / `ended` / `draft` | `secondary`, `outline`, `destructive` |
| Quiet metadata chip                   | `Badge variant="neutral"`     | `secondary`                                           |
| A dialog taller than the viewport | `DialogBody` around its middle | `overflow-y-auto` on `DialogContent` |
| A command with two ways to read it (Command / Agent prompt) | `CodeBlock layout="panel"` with `tabs` | two `CodeBlock`s, a `SegmentedControl` beside a label |
| Two views of one pane | `SegmentedControl` | a tab strip, two `Button`s |
| An address checked as you type | `SlugInput` + `FieldDescription tone` | an `Input` with hand-rolled glyphs |
| Label / value facts before moving on | `SummaryCard` | a `Card` of `div`s |
| An onboarding step's opening | `StepHeader` | a hand-built eyebrow row |
| A coding agent's logo | `AgentMark` | an `<img>` of a copied PNG |
| A text trigger in the composer's foot row | `ComposerToolButton` | a `Button variant="ghost"` |
| Which agent and model drive a session | `AgentModelSelect` | two pickers |
| How hard the agent thinks | `EffortPicker` | a dropdown of five words |
| What the agent may touch unattended | `PermissionMenu` | a toggle |
| Switching between the console's lists (sessions, routines) | `Rail` | a second `Sidebar`, tabs |
| Which repositories are in a project | `RepositoryAddField` | a `RepositorySelect` in a dialog, a table of checkboxes |
| What each of a project's repositories does in a new session, and from which branch | `RepositoryRowList` | a second `RepositoryAddField`, a table |
| A fold inside a dialog or a step (Defaults, Inspect command and prompt) | `Disclosure` | a chevron button over a `useState`, Base UI's Collapsible directly |
| Pairing a host: the copy buttons, the token line, the instruction, the status | the kit's `HostPairingChrome`, or its parts with `HostPairingInstruction` in its `panel` layout | two `CodeBlock`s, a `CodeBlock` alone, a second status row |
| A menu row that opens a pane in place (Appearance, Move to project…) | `DropdownMenuPaneItem` + `DropdownMenuBack` | `DropdownMenuSub` for a two-level pick |
| A note under a form, in any tone | `Callout` | `Alert`, a tinted `div` |
| Views inside one page (Routines / Runs, categories, run status) | `PillTabs` with `count` | a tab strip, `SegmentedControl` |
| How a routine page opens | `PageHeader` parts | a hand-built title row |
| A labelled picker in the routine editor | `FieldSelect` | `ChipSelect`, a `<select>` |
| Several picks read as one card (the editor's Where it runs) | `FieldSelectGroup` + `FieldSelectRow` around a `FieldSelect variant="quiet"` | a stack of labelled `FieldSelect`s |
| A trigger's variable parts | `InlineToken` in a `TokenSentence` | a form of pickers |
| A time or weekday pick | `TimeGrid` in a popover | a `<select>` of hours |
| Runs per day | `RunHistory` | a chart library |
| The routines overview, the runs, the templates | `RoutineTable`, `RunsList`, `TemplateGrid` | a hand-built `<table>`, cards |
| The automations overview, the one page over the main column | `EditorPage` from its layout route (`routes/_authenticated/automations.tsx`), `EditorPageTop` for its tabs; inside Settings, `PageHeader` parts + `RoutineSteps` | a `Card` of `Field`s, a hand-rolled scroll column, a new layout route |
| A form over the console (New project, Add a host, the automation editor) | a `Dialog` at its `form` or `lg` size, opened through `useConsoleDialog` | a page under a layout route, a `useState` per surface, a width on the caller |
| A settings page's rows | `SettingsGroup` + `SettingsRow` | a form of `Field`s in a `Card` |
| A host on Settings | `HostCard` | a `Card`, a table row |

Why: an error callout was hand-rolled in nineteen places while `Alert` sat
exported, and empty and loading states in five while `EmptyState` was used by
one.

## A picker over a list the workspace grows is an autocomplete

| The options are | Use |
| --- | --- |
| Two to four views of one pane | `SegmentedControl` |
| Fixed and short, known at build time, inside a menu | `DropdownMenuRadioGroup` |
| A scope chip on the console (project, host, branch, agent) | `ChipSelect`, always searchable; `variant="tab"` inside the composer's scope band |
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

No console screen pages, searches or filters a long list yet. When the first
one does, these hold:

- Search, filters, sort and page live in the URL (nuqs), never in
  `useState`, and the list resets to page one when it narrows.
- **Search and facets are the server's job.** Send the query and the facet
  ids in the request; never filter one page in the browser to answer a
  search box. A search matches everything the row shows: widen the endpoint
  rather than narrow the list.
- **The field owns the half-typed word.** It debounces once on the way out
  and hands the list the settled value; nothing else debounces, and a live
  value never reaches the rows (the render rules in
  [`frontend-architecture.md`](./frontend-architecture.md)).
- A route with `validateSearch` must carry unknown keys through, or it
  deletes what the list wrote on the next navigation. `/login` does, and says
  so in its own comment.

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

A screen the product picks for the reader (the dashboard `/` redirects to)
checks its own policies through `useLandingRoute` and answers `null` rather
than bouncing between errors. An org-less account goes to `/onboarding` from
the `_authenticated` layout.

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
`no-raw-colors`: `shadow-panel` is read as a colour.

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
