---
"@oppenheimer/design-system-web": patch
"@oppenheimer/web": patch
---

The console's icons match the version-1 frames. The frames' `settings` glyph
is lucide's `settings-2` (sliders), not the gear.

- `@oppenheimer/web`: the account menu's Settings link and a project's
  settings button in the sidebar draw `Settings2`; the composer's project
  chip draws `Folder`, not `FolderKanban`.
- `@oppenheimer/design-system-web`: `Callout`'s neutral and info tones take
  the alert circle and its danger tone a plain cross; `EffortPicker`'s hint
  is a question-mark circle; a `ChipSelect` foot action with `href` ends in
  an arrow out rather than a chevron.
