---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/web": patch
"@oppenheimer/web-showcase": patch
---

- `EditorPageBody`'s `size` takes the export's widths: `status`, `composer`
  (both centred in the pane), `narrow`, `wide`, `briefing`, `board`. The body
  bleeds the task board through its gutter; `--page-gutter` is gone.
- `EditorPage` paints no ground: the frame sits on its parent's.
- `DropZone` takes `outline="pane"` to trace the positioned ancestor rather
  than its own box.
- The kit exports `PageFrame`, the frame `AppShell` draws at a route's measure;
  a `full` screen renders it for a state that is a page. It returns a new page
  to the top without remounting it.
