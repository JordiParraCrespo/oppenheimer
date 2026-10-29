# design-system — Agent Instructions

Shared design system. This directory is a **container for the publishable
package**, one per platform:

- [`web/`](./web) → `@oppenheimer/design-system-web` — Base UI + Tailwind v4 (used by `apps/web`, `apps/web-showcase`, `packages/frontend/web`)

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first. There is no package.json
> at this level — work inside `web/`.

## The system

The source is the Claude Design export in `product/versions/mvp/design/`:
`_ds/…/tokens/*.css` for the tokens and `readme.md` for the rationale, and
the `version1/` artboards for what the screens actually do. Its one sentence:
**the product is the work, and the design system is the silence around it.**

- **Colour is rationed.** One blue for actions (`--primary`), one for links
  (`--link`). Status hues (green, amber, red) appear only as run state, never
  as decoration and never as a CTA. Everything else is achromatic. One primary
  button per view.
- **Two layers of colour.** The raw palette (`--op-gray-500`, `--op-blue-500`)
  is never referenced in product code. Semantic aliases (`--fg-muted`,
  `--card`, `--border-subtle`) re-point under `.dark` / `[data-theme="dark"]`,
  so a theme switch moves aliases only and no component holds a conditional
  colour. Dark is the version-1 artboards' lifted ramp (`#121213` canvas), not
  the export's true black.
- **One typeface.** The system stack (SF Pro on Apple platforms) does every
  job; Display is the same family at 600 with tighter tracking from 21px up.
  Weight never exceeds 600. Every number a human compares is the system mono
  (SF Mono on Apple platforms), tabular (`figures` utility). Nothing is
  vendored: the fonts are the reader's own.
- **One control ramp**: 28 / 34 / 42px for Button, IconButton, Input, ChipSelect.
  **A form's fields stand at 34px**: `Input`, `DatePicker` and
  `FieldSelect`'s field look default to the `md` rung, and a `Chip` that is a
  field takes `size="md"`, so a label column of mixed controls reads as one
  height. The three share one size map (`internal/control-size.ts`).
  A smaller or larger field is a `size` the caller asks for, never a height
  of the component's own.
- **Six radii and no others**: 6 · 10 · 14 · 18 · 28 · pill. Type into a 10,
  press a pill, read inside an 18.
- **Surfaces never cast shadows.** Depth is tonal. Only popovers, modals and
  glass carry one.
- **Motion** is 80 / 140 / 220 / 400ms, eased, never bouncy; a 4px rise plus
  fade for anything that appears. All durations go to 0 under reduced motion.
- **Copy** is sentence case, verb-first, no emoji. It navigates, it is a
  `Link`; it acts, it is a `Button`.
- **Every scope picker filters.** A `ChipSelect` popup always carries the
  search row and the empty line, even over three options, so the console's
  four chips behave as one thing. It is built on Popover, not Base UI
  Select, for that reason; `RepositorySelect` reuses its parts for the
  multi-repo pane. A foot action with `href` is a new-tab link.
- **Third-party marks are the vendors' own or nothing.** `AgentMark` ships
  Anthropic's Claude mark, the OpenAI mark for Codex, OpenCode's square,
  Grok's slashed circle and Cursor's cube from their published brand assets,
  and for a bot's providers Z.ai's mark for GLM and OpenAI's for ChatGPT (it
  publishes none of its own), in the vendor's colour where it has one
  and the current ink otherwise. An agent with no published mark takes the
  neutral glyph; never a redrawn imitation.
- **The composer's foot row reads scope of action, then engine.** Left:
  attach and the `PermissionMenu`. Right: `AgentModelSelect`, one button
  for agent, model and effort (a tab per agent and one of starred
  Favourites, a search across every agent, the effort slider at its foot;
  picking a model picks its agent, so the pair is always valid), mic, send.
  `EffortPicker` stays for a surface with no engine button (a bot's chat).
  All of them hang from `ComposerToolButton`. Full access is the one setting
  allowed the warning tone, because it can change a machine unattended. New
  session is `ComposerPill` (2026-10-25 export): one line with Add files,
  the mic and send, and under it a `ComposerChoices` row in the same order,
  where it runs and what it may touch on the left, the engine on the right,
  each place chip a `ChipSelectTrigger` in its `tab` variant. The first chip
  is the host and where on it as one ("mac-studio · New worktree"): its pane
  is `ChipSelectTabs` under the search, Hosts and Cloud, each with its
  count, and a host opens its Start in pane under a `ChipSelectHeading`. The box stands as tall as a session chat's
  `ChatComposer`, and the engine pane's rows are the `engine` density, 36px
  of 13.5px, beside a boxed search. That row never
  wraps: the place chips truncate and the engine keeps its width. `Composer`'s
  `scope` band, the tabbed form it replaced, has no caller in the console.
- **The console's chrome is a rail and a grouped sidebar.** `Rail` (56px)
  switches between the sessions and routines lists (under 768px it is a
  tab bar along the bottom of the screen, and the page beside it keeps
  clear with `RAIL_BAR_CLEARANCE`); the sidebar groups rows
  under `SidebarProjectHeader`s whose actions appear on hover, with
  `SidebarSearch` and the facet chips above the groups and `SidebarEmptyRow`
  inside an empty one. A `SessionItem` takes its ellipsis as `action` and its
  rename as an inline input; both hide the age while they show.
- **A pane, not a submenu, when the pick belongs to the row.** Appearance
  and Language in the account menu, and Move to project… in a row's menu,
  slide the same menu to a pane (`DropdownMenuPaneItem`, then
  `DropdownMenuBack` on top of it). `DropdownMenuSub` stays for the filter facets, which are several
  independent picks.
- **A trigger reads as a sentence.** In the routine editor every variable
  part of a trigger is an `InlineToken` in a `TokenSentence` ("Every
  [weekday] at [09:00]"), never a form to decode; mono tokens hold values a
  human compares. `TimeGrid` behind a time token disables past hours rather
  than hiding them, so the grid never reflows. The editor is `RoutineSteps`:
  a finished step inverts its number to a tick and prints its summary.
- **Status glyphs belong to finished things.** The check and alert circles
  appear only in `RunsList`, where each row is a finished run. Live state is
  a `StatusDot` and a word, and `RunHistory` is bars and dots, not a chart.
- **A callout never carries a button, except a failure's one action.**
  `Callout` is a note in the flow on a tonal fill; `neutral` is the default
  and takes no hue; a tinted tone only when something is in that state. The
  action lives in the form. `Alert` is the same box with a title, and a
  failure (`ErrorAlert`) may put its one Dismiss or Retry in `AlertAction`.
- **Copy first, read second, the prompt before the command.** Add a host
  (onboarding and the console's dialog) leads with the agent prompt: one
  card with Copy prompt, its text behind the card's fold, and the
  install command behind "Install manually instead", one line with its
  Copy. The Settings page shows both forms outright as one `CodeBlock
  layout="panel"` with Command / Agent prompt tabs on its band.
- **A fold is a `Disclosure`**: one row that reads as a label, an optional
  word, a summary while closed, a chevron that turns; the panel opens 14px
  under it. Defaults in the project dialog. Its two
  tones are the only two.
- **A dialog has three widths**, `md`, `form` and `lg`, and a caller never
  sets one.
- **A host that goes away is a phase of the terminal, not an error.**
  `Terminal` takes `hostLink`: the phase (`live`, `reconnecting`, `offline`,
  `catching-up`, `reconnected`), the host's name, and the form. The phase
  table in the package decides what each phase shows; the terminal locks the
  prompt and fades the scrollback itself, and `HostLinkChrome`, in the
  status bar's place, draws the rest. The **banner** is the console's form;
  the **notice** (a card over the scrollback) is the frames' other drawing
  of the same phases, not a second design. The session comes back on its
  own because the runner dials out, so the only control is the fix (How to
  fix), for when it does not. An offline host keeps its place in the host
  picker as a disabled option whose description says so, and the composer's
  `sendBlockedReason` says why send is off.
- **The fix for a machine is a command to copy, not a block to read.**
  `CommandRow` is one `$ command` with an icon copy button (Copy command →
  Copied), stacked in a `CommandRowList`; it is the fix in the host-link
  chrome and in an offline `HostCard`. `CodeBlock` stays for what is read
  before it is copied (the install command and agent prompt). Both copy
  through `useCopy`.
- **Files are dropped on the pane.** `DropZone` wraps New session and a
  running terminal: a drag carrying files draws the 3px action-blue outline
  around the whole pane, square and flush, with no fill and no label. It is
  its own box; `listen="window"` only on a page
  with one zone. A box that owns the edge but not the drop (the console's
  pane, which takes a framed page's drops) draws `DropOutline` itself.
- **Things move by dragging on one layer.** `drag.tsx` is headless and
  product-free: `useDraggable` / `useDroppable` (with `accepts` by
  `data.type`), and `SortableGroup` / `SortableItem` / `useSortableGroups`
  for order across groups, all inside one `DragProvider` per surface that
  the page owns. A component that drags (the month) draws sources and
  targets and never mounts its own provider. It wraps dnd-kit, which no app
  imports. The motion lives in the layer, on the token ramp (`--drag-lift`,
  the fast and base durations); a sortable item's own place is the drop
  slot. A board's provider is `live` (with `useSortableGroups`'
  `{ live: true }`): its ids reorder as the card moves, the slot going after
  a card once the pointer passes its middle, and every card that changes
  place slides there; other groups keep dnd-kit's displacement. Keyboard and
  announcements come with it; a surface translates the
  words through `labels`. A control inside a draggable spreads
  `dragIgnore`. Files from the desktop stay `DropZone`'s.
- **Plan composes the system's own vocabulary.** A task's status is the
  run-state dot (`TASK_STATUS_STATE`), its done toggle a `Checkbox`, a
  calendar source a `Checkbox` row, and a page that opens on its own name
  `PageHeaderRow size="display"`. `TaskBoard` lays out whatever columns it
  is given at its parent's width; `MonthCalendar` and `DatePicker` are the
  two faces of one month grid.
- **A gate is a status, not a new vocabulary.** Whether something may go
  ahead (checks, conflicts, a merge step) is a `StatusDot` gate state
  (`passing`, `blocked`, `waiting`), worded by the caller; a run's state
  stays a run state. A component never adds its own state union for a
  colour the dot already has.
- **A section is a `Card`.** `Panel` and `StatCard` compose `Card`; a
  numbered sequence is `Stepper`; what stands between a pull request and
  main is `MergePath`, one card row of gates, each a dot and a word; a share
  of a whole is `StatBar`, wherever it sits; a weight in ink (a pull
  request's lane) is a `Badge` variant (`strong`, `soft`), not a component
  per meaning.
- **Data colours are one set of tones.** Charts, stat bars and fact dots
  take a `DataTone` (`chart-1` to `chart-5`, the status hues, `muted`);
  `--chart-1` to `--chart-3` are a categorical order validated for
  colour-blind separation in both themes. Values sit in text ink, one
  axis, every chart answers the pointer and every multi-series one has a
  legend. No chart library.
- **One comment field.** A review's comment and a diff's draft are the
  same field: ⌘/Ctrl+Enter submits when there is something to submit, Esc
  cancels. A choice of a few described options is a `RadioGroup`.
- **Diffs are @pierre/diffs and the file tree is @pierre/trees**, wrapped
  so no app imports them. They draw in a shadow root, so their colours,
  type and radius reach them only as the tokens passed through their
  custom properties. The theme is the app's: `DiffView` takes
  `colorScheme` from the caller and never reads the OS or the document.
- **A file wears its type's mark.** `FileIcon` and the tree draw the same
  published icon set (@pierre/trees, its `complete` set). Its hue comes
  from one map, the `--file-icon-*` tokens in `globals.css`, which the
  tree reads too: an identity, like an agent's vendor colour, never a
  state. Never a redrawn logo, never a hue table in a component.
- **The rail's and the sidebar's order is the reader's.** The rail's items
  are `SortableRailItem`s in one `SortableGroup`, and each project's sessions
  are `SortableSessionItem`s in a `SortableGroup` per project, so a row
  reorders in its project or moves to another, a folded or empty one
  included. The projects reorder too: each is a
  `SortableSidebarProjectGroup` in a `SortableGroup` that takes `project`
  and lists `sortableProjectId`s (the group owns that namespace, since a
  project's own id names its sessions' group), its `SidebarProjectHeader`
  the handle (a click still folds it; its actions never pick it up). They sit in the shell's one `DragProvider`; the order and the
  project are the app's (`useSortableGroups`' `onMove`, the same write as
  Move to project…). A sortable item that is also a link or a button is a
  `useSortableControl`: Space picks it up and Enter opens it, and the
  screen reader hears that.
- **A sidebar row's actions are its ellipsis.** `SessionItem` and
  `RoutineItem` take `action` and `menuOpen` through one row shell; a
  routine row adds `lastRun`, a dot before the meta for how the last run
  ended, from the same table as `RoutineRun`'s.
- **A setting that applies when it flips is a `Switch`; one that waits for
  Save is a `Checkbox`.** A setting a template holds stays drawn, disabled,
  with its reason as the title.
- **A short set of values in a form is a `PillGroup`** (`.op-pill`): one
  value (For how long) or, with `multiple`, a set (a bot's projects). It
  holds a value; `PillTabs` switches what a page shows and
  `SegmentedControl` how one pane reads, so neither is a form field. A
  bounded count a person nudges (Parallel sessions) is a `NumberStepper`.
- **Sharing names people, then says who holds what.** `PeoplePicker` is a
  combobox over the workspace's members whose typed outside address becomes
  an invite; `AccessList` is who can open the thing, with the role and the
  time left in mono, the owner first and fixed, a link a row of its own.
- **A list page's facet is a `FacetSelect`**, unset on its first option and
  lit on the selected wash once narrowed: `pill` on Plan's board, `labelled`
  in the pull-request queue. Several facets of one menu stay
  `DropdownMenuSub`s.
- **Time on Plan.** Milestones lie on a `MilestoneTimeline` (diamonds on a
  track per project, today a line through every row), marked elsewhere by
  `MilestoneGlyph`; Stats reports over a `DateRangePicker` period, and
  volume over time is an `AreaChart` (monotone, so it never overshoots),
  rates without volume a `LineChart`. Several Google accounts are a
  `CalendarAccountList`.
- **An employee reads like a conversation.** `BotItem` is a photo, the
  name, the age and the last message, unread in full ink with the blue
  dot, waiting on the reader (`needsInput`) the same with the amber one.
  Its groups head with `SidebarProjectHeader tone="eyebrow"`, the Built-in
  group with a lock `marker`; before the first bot the list is a
  `SidebarEmptyCard`, and the chat a centred `ChatEmptyState` over
  `TemplateTiles`. A bot's message to another is a `BotExchange`, and the
  instructions it proposes for itself a `ProposedFile`. Its photo is
  picked with `AvatarPicker`. The photos are the product's own: the
  export's portraits are of real people and never ship. Until there is a
  set we may use, a bot's face is its initials in dark ink on one of the
  export's eight colours (`--avatar-*`, the same in both themes): `BotAvatar`
  and `BotItem` take `color`, and Profile picks it with `AvatarColorPicker`.
  A bot's routine is a `RoutineCard`, read and edited in place
  (`RoutineItem` is the workspace's, in the sidebar); records in a settings
  card are `SettingsListRow`s over a `SettingsAddRow`; `SettingsTopBar`
  says whose settings these are.
- **The chat is a 46rem column on the pane's recessed ground** (a session's
  chat stands on its terminal's ground instead, `--chat-ground`, and in its
  grid's column, the console's `TerminalColumn`, scrolling the whole pane, so
  Terminal / Chat changes no colour and moves neither edge of the text). The
  person's turns are cards on the right, the agent's are unboxed prose
  opened by a `TurnHeader` on its hairline; what the agent did (tool calls,
  reasoning) is in muted ink so it never reads as the answer. Work in
  flight breathes (`animate-shimmer`) and a streaming reply has its caret
  (`animate-caret`), both behind `motion-safe:`. Panels on the composer
  fuse onto its top (`ComposerStack`, `ComposerNotice`); a blocking
  request takes the composer's place (`ApprovalPanel`, `QuestionPanel`),
  and its number keys pick only while focus is inside it. In a bot's chat
  the request fuses onto the composer instead (`ComposerApproval` in
  `ChatComposer`'s `above`, under a Needs input line), so it can be answered
  in words.
- **A bot's chat is the Bots frame and AI Elements.** Your turns are
  28px bubbles, their time and copy on hover; the bot's answer has no
  header: a `Trace` line per tool call at the reply's 15px, muted, each
  opening to its `TraceOutput` (numbered mono lines on the card) or a
  `TraceNote`, failures in red, then the reply, its fenced code a
  `ChatCodeBlock` (a `ChatJsonBlock`, opening as a `JsonTree`, when it
  holds JSON), then a `MessageTrail` (copy, retry, model and tokens).
  While it runs a `TraceLive` line says what it is doing, with its clock.
  Between turns a `ChatMarker` notes a model switch and a
  `TranscriptDivider` a new day. Next steps are `ChatSuggestion` pills;
  the way back to the latest turn is `FloatingChip variant="round"`; the
  box is `ChatComposer`, a 28px card growing from two lines to eight, which
  shares `Composer`'s send rules and send button (`internal/composer-send`)
  rather than branching inside it. The trace lives in `chat-trace.tsx`,
  apart from the agent's tool-call groups in `chat-work.tsx`.

## Conventions

- **Tokens are the source of truth**: [`web/src/styles/globals.css`](./web/src/styles/globals.css).
  Palette, semantic aliases, type ladder, space, radii, elevation, motion,
  then the shadcn semantic names aliased onto them, then the Tailwind mapping
  in `@theme inline`. Change the system there; components inherit it.
- Prefer a semantic utility (`text-fg-muted`, `bg-canvas`, `border-border-subtle`,
  `rounded-pill`, `duration-fast`) over a raw value. Never a `dark:` colour
  override: the aliases already invert.
- The previous starter brand's names (`--ink-*`, `--surface-*`, `--status-*`)
  are kept as **legacy aliases** so the unported components in `apps/web`
  still render. Author nothing new against them; they go when the last
  component is ported.
- **The inventory is `web/src/components/`.** Every file there is public, and
  each is named in exactly one item's `components` in the showcase's
  `apps/web-showcase/src/lib/toc.ts`, which is where it is drawn.
  `web/src/internal/` holds what only components import. Nothing else is a
  list: the package's `test` fails when the folder, the barrel and `toc.ts`
  disagree. A component nothing uses is deleted, not kept for later.
- Preview every change in `apps/web-showcase`, in **both** themes; the top
  bar carries the switch.
