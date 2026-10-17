# @oppenheimer/web-showcase

## 0.3.0

### Minor Changes

- 73ce336: Port the 2026-10-13 evening export: `BotExchange` and `ProposedFile` in the chat's cards, `ComposerApproval` fused onto the composer through its new `above` slot, `BotItem`'s `needsInput`, `SidebarProjectHeader`'s eyebrow tone and `marker`, `SidebarEmptyCard`, `TemplateTiles` and a centred `ChatEmptyState`.
- 663e8ed: The 2026-10-13 export's new components. Settings controls: `Switch`,
  `PillGroup` (one value or a set) and `NumberStepper`. Share: `PeoplePicker`
  with `PersonChip`, and `AccessList`. Plan: `MilestoneTimeline` and
  `MilestoneGlyph`, `FacetSelect`, `DateRangePicker`, `AreaChart` and
  `CalendarAccountList`. Employees: `BotItem` (and `SortableBotItem`),
  `AvatarPicker`, `RoutineCard`, `SettingsListRow`, `SettingsAddRow` and
  `SettingsTopBar`. The agent chat, one file per family of the Chat Components
  inventory: transcript, work and tools, cards, dividers and status, the
  composer stack, decisions, composer extras and the header. Adds the
  `--selected-fg` token and the `shimmer` and `caret` animations.
- d4606c6: Pull requests on the 2026-10-13 screens, without the chat and the review
  agent.

  - `@oppenheimer/shared`, `@oppenheimer/api`, `@oppenheimer/api-client`: a
    review's verdict is `comment`, `approve`, `approve_and_merge` or
    `request_changes`. `approve` only approves now; `approve_and_merge`
    merges at once when GitHub allows it and otherwise turns on GitHub's
    auto-merge, answering `{ merged, autoMerge }`. The queue is ordered by
    lane (Deep first) and then the longest wait, and the path to merge is
    three gates (checks, conflicts, merge).
  - `@oppenheimer/frontend-consumer`: `ReviewOutcome`; the activity read
    (`usePullRequestActivity`) is removed.
  - `@oppenheimer/web`: a pull request is Description and Changes (a link to
    `?view=briefing` opens the description); the queue filters by repository,
    Difficulty, Checks and Waiting, with `j`/`k`, Enter and `/`; Review opens
    the changes; Settings → Watched repositories is where watching is set.
  - `@oppenheimer/design-system-web`: `MergePath` is the one-row status strip;
    `PullRequestTable` folds in three widths (1080px, 720px); `ChipSelect`
    options take a `count`. `FactTile`, `FactGrid`, `DiffCommentLink` and the
    Stepper's horizontal orientation are removed.
  - `@oppenheimer/translations`: the new queue, review, Settings and toast
    copy; the briefing, rail, activity and lane-reason keys are removed.

### Patch Changes

- e711f5c: Add a host leads with the agent prompt, in onboarding and in the console's
  dialog, as the 2026-10-13 design export draws it.

  - `@oppenheimer/frontend-web`: `PairingChrome` is agent first: the agent
    prompt in a card with Copy prompt (its text behind a fold), the token line
    with "Install manually instead" across from it (the install command on
    one line with its Copy, and the installer's digest), and a Connection
    list — Runner installed with its version, then Host connected with the
    machine's name and OS. The two folds are `Disclosure`s; the chrome's
    root carries `data-layout`, and each part sizes itself from it, so
    `PairingToken`, `PairingInstruction` and `PairingStatus` lose their
    `layout` prop. `PairedMachine` gains `runnerVersion`.
  - `@oppenheimer/web`: the onboarding step puts Continue, Skip for now and
    its note on one row; the dialog's copy follows the export.
  - `@oppenheimer/design-system-web`: `Disclosure`'s doc no longer names Add
    a host.
  - `@oppenheimer/web-showcase`: the Add a host demo draws the same column.
  - `@oppenheimer/translations`: `hosts.pairing` gains `manual`,
    `manualLead`, `connection`, `installWaiting`,
    `installed` and `connected`; `copyPrompt` reads "Copy prompt";
    `copyCommand` and `inspect` are removed. `hosts.add.description`,
    `onboarding.flow.host.description` and `skipNote` follow the export.

- fe61b51: Sharing a session follows the `ShareSession` design
  (`product/versions/mvp/21-session-share-links.md`): one share per session
  at one address, `/s/<slug>`, for named people or anyone signed in; view, or
  write for named people for 24 hours at most. The Share dialog opens from a
  row's menu and the terminal's status line, and the guest page is one bar
  and the terminal. The share-link routes are replaced by
  `GET`/`PUT`/`DELETE /v1/sessions/{id}/share` and
  `PATCH /v1/sessions/{id}/share/people`; existing links are dropped. The
  design system gains `RadioGroupCard` (with `columns` on `RadioGroup`) and an
  `actions` slot on `SessionPaneHeader`.
- 27f034a: The wordmark stands alone: the console's brand row and the auth and public
  pages show "Oppenheimer" without the "Console" suffix. `Wordmark` loses its
  `product` prop, `BrandLogo` is gone (the auth and public chrome draw
  `Wordmark` directly), `AuthLayout` loses its `product` prop, and the
  `common.product` key is gone from the catalogs.
- Updated dependencies [e711f5c]
- Updated dependencies [50429c4]
- Updated dependencies [39dbe36]
- Updated dependencies [502a40c]
- Updated dependencies [ac929fa]
- Updated dependencies [581c202]
- Updated dependencies [6af341b]
- Updated dependencies [73ce336]
- Updated dependencies [663e8ed]
- Updated dependencies [231fb59]
- Updated dependencies [a80436f]
- Updated dependencies [d4606c6]
- Updated dependencies [6917f62]
- Updated dependencies [45d642b]
- Updated dependencies [fe61b51]
- Updated dependencies [13374f0]
- Updated dependencies [a68c88c]
- Updated dependencies [27f034a]
  - @oppenheimer/design-system-web@0.3.0
  - @oppenheimer/shared@0.4.0

## 0.2.0

### Minor Changes

- 9431938: The design system draws a session's host going offline and coming back
  (a banner in the status bar's place by default, a card over the scrollback
  as the other form), the command to copy that brings it back, an offline
  host's detail on Settings, and a pane that takes dropped files.
- 08d42f1: A generic drag layer, and Plan in the design system: the task board and
  goals, the month calendar, the date picker and the session pane's header.
  `PageHeaderRow` takes a `display` size.
- 121d28a: Pull requests in the design system: the queue, a pull request's briefing
  and review decision, the diff with its comments and file tree (on
  @pierre/diffs and @pierre/trees), file-type marks, the review analytics'
  charts, and a rail the reader can reorder. `SegmentedControl` takes `md`
  and `lg` sizes and item counts; `StatusDot` gains the gate states
  `passing`, `blocked` and `waiting`; `Badge` gains `strong` and `soft`;
  `Stepper` lays out horizontally; `RadioGroup` is new; the dark chart teal and violet moved to
  pass colour-blind separation.

### Patch Changes

- c983201: The sidebar's sessions reorder by dragging, inside a project or into another
  one (`SortableSessionItem`). A sortable row that is also a link picks up on
  Space so Enter still opens it, and the screen reader is told so
  (`useSortableControl`).
- c05c4ff: - The shell frames a page at the route's measure: `staticData.pane` is a size
  of `EditorPageBody`, or `full`. `measure` is gone.
  - `EditorPageBody` takes `size` instead of `wide`; `TaskBoard`'s `gutter` prop
    is gone.
- 473557a: - `EditorPageBody`'s `size` is a measure the export repeats: `status`,
  `composer`, `narrow`, `wide`, `board`, `fluid`. A child opts in to the
  frame's edge with `data-bleed`.
  - The shell frames the page; `EditorPage` paints no ground.
  - `staticData.pane` may be a function of the route's search.
  - The kit adds `PaneBar` and `usePaneDrop`; the design system exports
    `DropOutline`.
- c237a5f: The console's sidebar reorders by dragging: a project by its header among
  the others (`SortableSidebarProjectGroup`), and a session within its project
  or into another one, which moves it there. The order is kept on the device,
  and the sort menu gains Custom order, its new default.
  `useSortableGroups` tells `onChange` when a drag settles and hands `onMove`
  the value it settled on; a session write stays pending until the session
  lists have refetched.
- Updated dependencies [27af598]
- Updated dependencies [cb56034]
- Updated dependencies [1a51afc]
- Updated dependencies [eff0947]
- Updated dependencies [f099524]
- Updated dependencies [604707a]
- Updated dependencies [1ed003e]
- Updated dependencies [080641e]
- Updated dependencies [64d3f7a]
- Updated dependencies [f099524]
- Updated dependencies [cb56034]
- Updated dependencies [287d688]
- Updated dependencies [a880b19]
- Updated dependencies [7945f7e]
- Updated dependencies [9431938]
- Updated dependencies [08d42f1]
- Updated dependencies [121d28a]
- Updated dependencies [c983201]
- Updated dependencies [c5437b1]
- Updated dependencies [09cea4c]
- Updated dependencies [f099524]
- Updated dependencies [7ed4e17]
- Updated dependencies [79e30e5]
- Updated dependencies [83f3617]
- Updated dependencies [c078d0d]
- Updated dependencies [8e2de68]
- Updated dependencies [fc0e75d]
- Updated dependencies [94a700e]
- Updated dependencies [88f7898]
- Updated dependencies [2202daa]
- Updated dependencies [5bd4a8b]
- Updated dependencies [c05c4ff]
- Updated dependencies [ed28ce2]
- Updated dependencies [d5d310c]
- Updated dependencies [1c2ae71]
- Updated dependencies [473557a]
- Updated dependencies [2dc27d2]
- Updated dependencies [e505b9e]
- Updated dependencies [0918701]
- Updated dependencies [0918701]
- Updated dependencies [a23b14e]
- Updated dependencies [173bb4c]
- Updated dependencies [cefbc53]
- Updated dependencies [9ffae03]
- Updated dependencies [6b943c3]
- Updated dependencies [b32d3b8]
- Updated dependencies [38b511f]
- Updated dependencies [f099524]
- Updated dependencies [f099524]
- Updated dependencies [dcc5fe1]
- Updated dependencies [bbacd49]
- Updated dependencies [5b93fd7]
- Updated dependencies [f099524]
- Updated dependencies [8fab63d]
- Updated dependencies [b2fd6a1]
- Updated dependencies [a566fac]
- Updated dependencies [064c443]
- Updated dependencies [3404cd3]
- Updated dependencies [bb3c4e8]
- Updated dependencies [ca05d90]
- Updated dependencies [f101364]
- Updated dependencies [8f5fd3d]
- Updated dependencies [3e6e3dc]
- Updated dependencies [097956a]
- Updated dependencies [b6676f8]
- Updated dependencies [c237a5f]
- Updated dependencies [b336aae]
- Updated dependencies [4ffcdd6]
- Updated dependencies [1a51afc]
  - @oppenheimer/shared@0.3.0
  - @oppenheimer/design-system-web@0.2.0
