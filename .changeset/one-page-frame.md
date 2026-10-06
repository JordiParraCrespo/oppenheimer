---
"@oppenheimer/design-system-web": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/web": patch
"@oppenheimer/web-showcase": patch
---

Every console page sits on one ground, the design export's grey, in one frame
the shell draws. Plan was on white while the automations, Pull requests and
New session were on the grey `canvas-recessed`, and each page framed itself at
its own width.

- `AppShell` paints the grey under every pane and draws `EditorPage` around
  every page: route `staticData.pane` is now the page's measure, `narrow` (the
  default), `wide` or `board`, or `full` for a screen whose box is the pane.
  `measure` is gone. The frame is keyed by the leaf route, so a new page opens
  at the top.
- `EditorPageBody` takes `size` instead of `wide` and publishes its gutter as
  `--page-gutter`. `TaskBoard` bleeds through that gutter on its own, and its
  `gutter` prop is gone.
- Plan, the automations and Pull requests are layout routes that declare their
  measure and render only their `Outlet`; `pnpm check:structure` fails a
  screen that paints the ground or draws `EditorPage` itself.
