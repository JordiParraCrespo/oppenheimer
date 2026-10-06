---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/web": patch
"@oppenheimer/web-showcase": patch
---

Every console page sits on one ground, in one frame the shell draws. The
automations and New session were on the grey `canvas-recessed` while Plan was
on white, and each page framed itself at its own width.

- `AppShell` draws `EditorPage` around every page: route `staticData.pane` is
  now the page's measure, `narrow` (the default), `wide` or `board`, or `full`
  for a screen whose box is the pane. `measure` is gone. The frame is keyed by
  the leaf route, so a new page opens at the top.
- `EditorPage` is on `canvas`; `EditorPageBody` takes `size` instead of
  `wide` and publishes its gutter as `--page-gutter`. `TaskBoard` bleeds
  through that gutter on its own, and its `gutter` prop is gone.
- `RunsList`, `RunHistory` and `RoutineTable` carry a hairline; the selected
  `md` pill tab, `PageHeader`'s glyph and its note take the hover wash.
- Plan and the automations are layout routes that declare their measure and
  render only their `Outlet`; `pnpm check:structure` fails a screen that
  paints the ground or draws `EditorPage` itself. Settings keeps its grey.
