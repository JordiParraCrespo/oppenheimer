---
"@oppenheimer/design-system-web": minor
"@oppenheimer/web-showcase": minor
---

The design system draws the 2026-10-03 export's new states: a host going
offline and coming back, files dropped on a pane, and an offline host's fix.

- `@oppenheimer/design-system-web`: `TerminalBanner`, `TerminalBannerToggle`,
  `TerminalDrawer`, `TerminalDrawerText` and `TerminalNotice`;
  `TerminalStatusLink` takes `offline` and `TerminalScrollback` takes `fade`.
  `CommandRow` and `CommandRowList`. `DropZone` over the new `useFileDrag`
  hook. `HostCard` takes `detail`, with `HostCardNote` and `HostCardFoot`.
  `RoutineItem` takes `action`, `menuOpen`, `lastRun` and `lastRunLabel`.
  A `Stepper` step takes `note`; `Composer` takes `sendBlocked`. New motion
  tokens `animate-appear` and `animate-appear-fast`.
- `@oppenheimer/web-showcase`: the DropZone and Host offline sections, and
  the new states of HostCard, RoutineItem, Stepper, Composer and ChipSelect.
