# Frontend UI: the component catalog

The rest of the table under "Reach for the design system before writing
markup" in [`.agents/rules/frontend-ui.md`](../rules/frontend-ui.md), split
out so the rule file stays short. Each row is a rule: when you need what the
first column says, use the second, never the third. Read
`packages/frontend/design-system/web/src/index.ts` in full as well.
`pnpm check:ui-catalog` (`scripts/ui-catalog.mjs`) fails a row whose Use
column names a component that is not a public export, and a design-system
module that no Use column here or in the rule names, unless it opens with
`// uncatalogued: <why>`.

This page lives outside `.agents/rules/` on purpose: a file there without a
`paths` frontmatter would load in every session.

| Need                                  | Use                           | Not                                                   |
| ------------------------------------- | ----------------------------- | ----------------------------------------------------- |
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
| A note between turns, next steps to offer, a fenced block in a bot's reply | `ChatMarker` (a day is a `TranscriptDivider`), `ChatSuggestions` + `ChatSuggestion`, the kit's `ChatCode` in `Markdown`'s `code` slot (a `ChatCodeBlock`, or a `ChatJsonBlock` when the fence holds JSON) | a `Callout`, a row of `Button`s, a `CodeBlock` |
| JSON in the chat: a fence, a tool call's answer | `JsonTree`, through the kit's `ChatCode` and `ChatToolOutput` (its ISO times read in words) | `JSON.stringify` into a `pre`, a JSON viewer library |
| A turn's files, plan, subagents, questions, objects | `ChangedFilesCard`, `ProposedPlanCard`, `SubagentRunCard`, `QuestionsPill`, `ContextCard` | a `Card` of `div`s, a `PullRequestRow` |
| What a bot said to another bot, and the instructions it proposes for itself | `BotExchange` + `BotExchangeTurn`; `ProposedFile` + `ProposedFileLine` (`ProposedFileAction` for its quiet choices, `outcome` once decided) | a `ChatUserMessage`, a `DiffView` of one file |
| A boundary, a failed turn, a run notice, a floating pointer in the chat | `TranscriptDivider`, `ChatErrorBanner`, `ChatNotice`, `FloatingChip` (`round` for a bot chat's way back to the latest turn) | `Alert`, `ErrorAlert`, `Callout`, a `Separator` with a label |
| Panels on top of the chat composer, or one notice there | `ComposerStack` + `ComposerStackRow`, `ComposerTaskList`; `ComposerNotice` | a `Card` above the `Composer` |
| A blocking approval or question in the chat | `ApprovalPanel`, `QuestionPanel`; in a bot's chat, `ComposerApproval` in `ChatComposer`'s `above` | a `Dialog`, a `RadioGroup`, an `ApprovalPanel` stacked over the composer |
| A field someone writes prose into (a prompt, notes, a comment, a document) | dictation: a host that frames its own field (`Composer`, `ChatComposer`, `DiffCommentDraft`, `ReviewDecision`) takes `dictation={dictationSlots(useDictation(…))}`, a plain `Textarea` sits in the kit's `DictationField`; the text goes in through `dictateInto` / `dictateIntoField`, the `voice` is the product package's `useVoiceDictation()`, one per screen | a recorder of the feature's own, a mic `IconButton`, `getUserMedia` in a feature, an append written by hand |
| The context meter, the `/` and `@` menus | `ComposerContextMeter`, `ComposerMenu` | a `Command`, a `Progress` |
| The chat's header, open threads, find, an empty thread | `ChatHeader`, `ChatTabStrip` + `ChatTab`, `ThreadFindBar`, `ChatEmptyState` (`align="center"` over `TemplateTiles` + `TemplateTile` for a new bot) | `SessionPaneHeader`, a tab strip of your own |
