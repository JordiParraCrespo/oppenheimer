---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/web": patch
"@oppenheimer/web-showcase": patch
---

- `EditorPageBody`'s `size` is a measure the export repeats: `status`,
  `composer`, `narrow`, `wide`, `board`, `fluid`. A child opts in to the
  frame's edge with `data-bleed`.
- The shell frames the page; `EditorPage` paints no ground.
- `staticData.pane` may be a function of the route's search.
- The kit adds `PaneBar` and `usePaneDrop`; the design system exports
  `DropOutline`.
