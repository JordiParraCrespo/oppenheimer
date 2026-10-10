# @oppenheimer/web-showcase

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
