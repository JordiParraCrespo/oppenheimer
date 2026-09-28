---
"@oppenheimer/design-system-web": minor
"@oppenheimer/translations": patch
"@oppenheimer/web": patch
---

The automations pages, the editor, the sidebars and Settings match the
2026-09-27 frames.

- `@oppenheimer/design-system-web`: `EditorPage` sits on `canvas-recessed`;
  new `RoutineStatus`; `FieldSelect` takes `variant="quiet"` and ships
  `FieldSelectGroup` / `FieldSelectRow`; dialogs keep 20px under the body and
  12px over the footer; sizes corrected on `PillTabs`, `InlineToken`,
  `TokenSentence`, `AddRow`, `RunRow`, `SettingsRow`, `SettingsNavItem`,
  `PageHeaderNote`, `RoutineItem` and the project header's chevron.
- `@oppenheimer/web`: an automation's page opens on Back and the ordinary page
  header; Where it runs is one card of rows; the sidebars' project groups,
  Projects label and search follow the frame; New session is secondary while
  it is open; the GitHub mark no longer inverts in dark mode.
- `@oppenheimer/translations`: `automations.editor.repoCount`; the unused
  `automations.editor.inProject` is gone.
