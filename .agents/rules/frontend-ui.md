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
| Pairing a host: the copy buttons, the token line, the instruction, the status | the kit's `PairingChrome`, or its parts with `PairingInstruction` in its `panel` layout | two `CodeBlock`s, a `CodeBlock` alone, a second status row |
| A menu row that opens a pane in place (Appearance, Move to project…) | `DropdownMenuPaneItem` + `DropdownMenuBack` | `DropdownMenuSub` for a two-level pick |
| A note under a form, in any tone | `Callout` | `Alert`, a tinted `div` |
| Views inside one page (Routines / Runs, categories, run status) | `PillTabs` with `count` | a tab strip, `SegmentedControl` |
| How a routine page opens | `PageHeader` parts | a hand-built title row |
| A labelled picker in the routine editor | `FieldSelect` | `ChipSelect`, a `<select>` |
| Several labelled picks read as one card (the automation editor's Where it runs is one) | `FieldSelectGroup` + `FieldSelectRow` around a `FieldSelect variant="quiet"` | a stack of labelled `FieldSelect`s |
| A trigger's variable parts | `InlineToken` in a `TokenSentence` | a form of pickers |
| A time or weekday pick | `TimeGrid` in a popover | a `<select>` of hours |
| Runs per day | `RunHistory` | a chart library |
| The routines overview, the runs, the templates | `RoutineTable`, `RunsList`, `TemplateGrid` | a hand-built `<table>`, cards |
| The bar a console page opens on, with the sidebar toggle | nothing: the shell draws it. With something in it, `staticData.bar: 'own'` on the route and the kit's `PageBar` (`leading`, `title`, `meta`, `status`, `tabs`, `actions`); a toolbar of the screen's own leads with `SidebarToggle` | `ChatHeader` with a toggle of its own, a `useSidebar` button in a feature, an empty `PageBar` |
| A console page (the automations, Plan, Pull requests, New session) | the route's `staticData.pane` measure, which the shell frames; `PaneBar` for a bar that stays above the page; `EditorPageTop` for a page's tabs; inside Settings, `PageHeader` parts + `RoutineSteps` | `EditorPage` in a route or a screen, a hand-rolled scroll column, a `max-w-*` column of its own |
| A form over the console (New project, Add a host, the automation editor) | a `Dialog` at its `form` or `lg` size, opened through `useConsoleDialog` (`apps/web/src/lib/console.ts`, over the kit's `createDialogSlot`) | a page under a layout route, a `useState` per surface, a width on the caller |
| A settings page's rows | `SettingsGroup` + `SettingsRow` | a form of `Field`s in a `Card` |
| A host on Settings | `HostCard` | a `Card`, a table row |
| What an offline host is holding up, and its fix, on Settings | `HostCard`'s `offline` | an `Alert` under the card |
| A session whose host went offline, reconnects or catches up | `Terminal hostLink={{ phase, host }}` with `HostLinkChrome` in the status bar's place (the banner; the notice form only if the product chose it) | an `Alert` or `ErrorAlert` above the terminal, a hand-built banner |
| A command someone runs on their own machine to fix it | `CommandRow` in a `CommandRowList` | a `CodeBlock` per command, inline `<code>` in a sentence |
| Attaching files by dropping them on a pane | `DropZone` around a `full` pane; on a page the shell frames, the kit's `usePaneDrop` | `dragenter` listeners in a feature, an outline drawn by a screen |
| Moving or reordering things by dragging (cards between columns, an entry to another day, a session to another project, the sidebar's and the rail's order) | the drag layer: `DragProvider` with `SortableGroup` / `SortableItem` or `useDraggable` / `useDroppable`; `SortableSessionItem`, `SortableSidebarProjectGroup` and `SortableRailItem` for the sidebar's sessions and projects and the rail, `useSortableControl` for any other item that is also a link or a button | `draggable` attributes, pointer listeners, dnd-kit imported in a feature |
| Plan's tasks by status | `TaskBoard`, `TaskColumn`, `TaskCard`, `TaskSessionChip`, `TaskComposer`; `MilestoneCard` above | a `Card` grid, a table |
| A month with things on its days | `MonthCalendar` (`CalendarEntry` per item) inside the page's `DragProvider` | a grid of `div`s, a calendar library |
| Picking a day | `DatePicker` | `<input type="date">`, a `ChipSelect` of dates |
| A page that opens on its own name with a line of counts | `PageHeaderRow size="display"` + `PageHeaderStat`s in `PageHeaderMeta indent={false}` | a hand-built `h1` and a paragraph |
| The bar over a session's terminal | `SessionPaneHeader` (and `SessionPaneBack` from a task) | a row of spans over the `Terminal` |
| The pull requests waiting on someone | `PullRequestTable` with `PullRequestRow`s (the lane a `Badge` `strong` / `soft`, checks and conflicts as `StatusDot` gate states, `MergeButton`) | a `RoutineTable`, a hand-built grid, a badge per lane |
| A pull request's opening | `PullRequestHeader` | a `Card` of `div`s |
| Gates as one strip (the diff stat and files in `leading`, the gates, their actions) | `MergePath` | a `Card` of `div`s, a `Stepper` of gates |
| A review period's numbers | `StatCard` (+ `StatBar`, `StatDelta`), `Panel` | a `Card` of `div`s |
| Whether something may go ahead (checks, conflicts, a gate) | `StatusDot` with `passing` / `blocked` / `waiting` | a new state union, a coloured `Badge` |
| One of a few described options (a review's verdict) | `RadioGroup` + `RadioGroupItem` | a list of `Button`s, a `SegmentedControl` |
| Submitting a review | `ReviewDecision` in a `Popover` from `SubmitReviewButton` | a `Dialog`, a `DropdownMenu` of verdicts |
| A diff, its comments and its files | `DiffFile` + `DiffFileHeader` + `DiffView` (`colorScheme` from the app's theme; `DiffComment`, `DiffCommentDraft`), `DiffFileTree` | a `<pre>`, a diff library imported in a feature |
| A file's type mark | `FileIcon` | a copied logo, an extension in text |
| Rendered markdown someone wrote | the kit's `Markdown` inside `Prose` (in a chat, inside `ChatReply`) | `dangerouslySetInnerHTML` into an unstyled `div`, a markdown library imported in a feature |
| Counts over time, shares of a whole, ranked reasons | `BarChart`, `LineChart`, `RingChart`, `BarList` | a chart library, `RunHistory` stretched |
| A choice that exists but cannot be picked now (an offline host) | a `disabled` `ChipSelect` option whose `description` says why | hiding it, an error after the pick |
| A setting that applies the moment it flips | `Switch` | a `Checkbox` with no Save, a `SegmentedControl` of On / Off |
| A short set of values in a form, one or several (For how long, a bot's projects) | `PillGroup` (`multiple` for a set) | `PillTabs`, `SegmentedControl`, a row of `Chip`s with your own state |
| A small bounded count (Parallel sessions) | `NumberStepper` | an `Input type="number"`, a `ChipSelect` of numbers |
| Who a thing is shared with, by name or email | `PeoplePicker` (+ `PersonChip`) | a `ChipSelect` of members, an `Input` and a list of your own |
| Who can open a shared thing, and until when | `AccessList` + `AccessRow` | a `SummaryCard`, a table |
| One facet of a list page's filter (Plan's Project, the queue's Checks) | `FacetSelect` (`pill` or `labelled`) | a `DropdownMenu` with a hand-built trigger, `PillTabs` |
| Milestones on time | `MilestoneTimeline`; `MilestoneGlyph` for the mark elsewhere | a `MonthCalendar`, a hand-drawn diamond |
| The period a page reports on | `DateRangePicker` | two `DatePicker`s |
| Volume over time (tokens, cost) | `AreaChart` | `LineChart` with a fill of your own, a chart library |
| Several connected calendar accounts | `CalendarAccountList` + `CalendarAccountRow` + `CalendarAccountAdd` | a `Card` per account |
| An employee in the sidebar | `BotList` + `BotItem` (`SortableBotItem` to move it; `needsInput` when it waits on the reader) | a `SessionItem` with an avatar |
| Employees' group heads, and the list before the first bot | `SidebarProjectHeader tone="eyebrow"` (`marker` for the Built-in lock); `SidebarEmptyCard` | an uppercase `span`, a `Callout` in the sidebar |
| A bot's photo | `AvatarPicker` (`compact` in a popover, `wide` on Profile); `BotAvatar` to draw one | a grid of `Avatar` buttons |
| A bot's colour, while its avatar is its initials | `AvatarColorPicker`; `BotAvatar` / `BotItem` with `color` | a row of coloured `div`s, a hex from the database |
| A file edited in place (a bot's SOUL.md, INSTRUCTIONS.md) | `Textarea variant="code"`; `SegmentedControlItem mono` to switch files | a `Textarea` restyled to mono |
| A bot's own routine | `RoutineCard` | a `RoutineItem`, a `Card` of `div`s |
| Records in a settings card (revisions, facts, connectors) and adding one | `SettingsListRow` + `SettingsAddRow` | a `SettingsRow` per record, an `Input` and a `Button` |
| The bar over one thing's own settings | `SettingsTopBar` | a `PageHeader`, a hand-built header |
| The agent chat's transcript | `ChatTranscript` with `ChatUserMessage`, `TurnHeader`, `ChatReply`, `MessageTrail` | a `Card` per message, `Prose` alone |
| What the agent did in a turn | `ToolCallGroup` + `ToolCallRow`, `ToolCallLive`, `ReasoningRow`; in a bot's chat, a `Trace` of `TraceStep`s (each opening to a `TraceOutput` or `TraceNote`) and `TraceLive` while it runs | a `Disclosure` per call, a `CodeBlock` of the log |
| A note between turns, next steps to offer, a fenced block in a bot's reply | `ChatMarker` (a day is a `TranscriptDivider`), `ChatSuggestions` + `ChatSuggestion`, `ChatCodeBlock` through the kit's `Markdown` `code` slot | a `Callout`, a row of `Button`s, a `CodeBlock` |
| A turn's files, plan, subagents, questions, objects | `ChangedFilesCard`, `ProposedPlanCard`, `SubagentRunCard`, `QuestionsPill`, `ContextCard` | a `Card` of `div`s, a `PullRequestRow` |
| What a bot said to another bot, and the instructions it proposes for itself | `BotExchange` + `BotExchangeTurn`; `ProposedFile` + `ProposedFileLine` (`ProposedFileAction` for its quiet choices, `outcome` once decided) | a `ChatUserMessage`, a `DiffView` of one file |
| A boundary, a failed turn, a run notice, a floating pointer in the chat | `TranscriptDivider`, `ChatErrorBanner`, `ChatNotice`, `FloatingChip` (`round` for a bot chat's way back to the latest turn) | `Alert`, `ErrorAlert`, `Callout`, a `Separator` with a label |
| Panels on top of the chat composer, or one notice there | `ComposerStack` + `ComposerStackRow`, `ComposerTaskList`; `ComposerNotice` | a `Card` above the `Composer` |
| A blocking approval or question in the chat | `ApprovalPanel`, `QuestionPanel`; in a bot's chat, `ComposerApproval` in `ChatComposer`'s `above` | a `Dialog`, a `RadioGroup`, an `ApprovalPanel` stacked over the composer |
| A field someone writes prose into (a prompt, notes, a comment, a document) | dictation: a host that frames its own field (`Composer`, `ChatComposer`, `DiffCommentDraft`, `ReviewDecision`) takes `dictation={dictationSlots(useDictation(…))}`, a plain `Textarea` sits in the kit's `DictationField`; the text goes in through `dictateInto` / `dictateIntoField`, the `voice` is the product package's `useVoiceDictation()`, one per screen | a recorder of the feature's own, a mic `IconButton`, `getUserMedia` in a feature, an append written by hand |
| The context meter, the `/` and `@` menus | `ComposerContextMeter`, `ComposerMenu` | a `Command`, a `Progress` |
| The chat's header, open threads, find, an empty thread | `ChatHeader`, `ChatTabStrip` + `ChatTab`, `ThreadFindBar`, `ChatEmptyState` (`align="center"` over `TemplateTiles` + `TemplateTile` for a new bot) | `SessionPaneHeader`, a tab strip of your own |

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
or the kit is photographed on a console route that renders it. The Stop
hook `.agents/hooks/screenshot-guard.mjs` holds a task's end until the
pictures are of the code as it is (`.agents/hooks/visual-change.mjs`
defines what counts).

## Dead code

Biome's `noUnusedImports` cannot see an exported component nothing imports.
When you delete the last caller of something, delete the thing.
