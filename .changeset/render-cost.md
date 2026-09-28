---
"@oppenheimer/frontend-core": patch
"@oppenheimer/frontend-consumer": patch
"@oppenheimer/frontend-web": minor
"@oppenheimer/design-system-web": patch
"@oppenheimer/web": patch
---

The console renders what changed, and nothing it cannot compile.

- `@oppenheimer/frontend-core`, `@oppenheimer/frontend-consumer`: every query
  hook passes `structuralSharing: shareEntities`, so a refetch keeps the rows
  that did not change. `useCaptureOnMount` no longer writes a ref in render.
- `@oppenheimer/frontend-web`: **breaking for callers of the old names.**
  `ConsoleDialogProvider`, `useConsoleDialog`, `ConsoleDialogRequest`,
  `useConsoleList` and `ConsoleList` are gone; `createDialogSlot<TRequest>()`
  replaces them, with `open`/`close` and the request on two contexts. The app
  names its requests. `useHotkey` no longer writes a ref in render.
- `@oppenheimer/design-system-web`: `FieldSelect` measures its trigger when the
  popup opens, so the compiler compiles it.
- `@oppenheimer/web`: the sidebars' search boxes own the half-typed word, a
  session row owns its menu, rename and writes, each group owns its minute
  clock, and the project dialog is a loader, a dialog, a pure form and a
  section per picker. New render budgets cover each.
