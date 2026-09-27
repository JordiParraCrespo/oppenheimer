# 2026-09: the Oppenheimer MVP port

Do not replay these. They are how one export was reconciled with one
starter's leftovers; the next export will differ. Kept so an agent can see
what a full run looked like and steal a trick, not a target inventory.

- Export: `product/versions/mvp/design/`, Claude Design. System under
  `_ds/<id>/` (readme, `tokens/*.css`, `components/*/*.css`), artboards
  under `version1/*.dc.html` with `ds-base.js` overriding the dark ramp
  (true black lifted to `#121213`) and the light sidebar surface. Component
  markup used an `op-` class prefix.
- Decisions: artboard ramp won; screens-only inventory; the starter's
  components kept compiling through a marked legacy alias block, which the
  review afterwards asked to remove in favour of a rename.
- Review corrections that shaped the inventory: the photo panel was a
  carousel; "Back to sign in" a link, not a button variant; the password
  reveal one component; the four scope pickers a select with a chip
  trigger plus an action row; three console menus one menu component;
  the terminal a frame; the theme toggle dropped because appearance was a
  menu row.
- Fonts: the export vendored Apple's SF Pro and SF Mono; the port subset
  them, and the review rejected redistributing them. Use system stacks.
- CI trap: the starter manifest check flags any file naming an optional
  app; the skill's showcase script had to be listed under `web-showcase`
  and the export folder skipped by the check.
- PRs: JordiParraCrespo/oppenheimer#6 (the port), #7 (this skill).

## 2026-09-19: the second sync

- The export moved under the port. Two later commits reworked the
  artboards without touching `_ds/`; the walk that mapped them is
  recorded in the MVP decision log (2026-09-19) and in 00/05/08, not in
  a separate audit file: the review of PR #20 rightly refused a third
  spec beside the notes and the export. Diff the artboards
  against the previous sync before re-rendering: most of the delta was in
  markup the shooter cannot see (search rows, a multi-select, a pane swap).
- The shooter's `page.route` for vendored CDN scripts never matches when
  the page loads them with `crossorigin` and SRI; the captures only worked
  because `ignoreHTTPSErrors` let the proxy serve them. A state capture
  script (typing, clicking through panes) needs its own Playwright run
  with the same flag.
- Base UI `Select` cannot filter; the chip picker was rebuilt on Popover
  with exported parts so a two-pane picker reuses them. Base UI's
  `PopoverTrigger render` overwrites the child's `data-slot`, so test
  selectors target `aria-label` instead.
- Third-party logos: the export carried PNG copies from another repo.
  The decision was vendors' official SVGs inline, in the vendor's colour,
  with a neutral glyph where none is available.

## 2026-09-27 — the dialogs came back

Not a recipe to replay; what this export needed that the workflow did not
predict.

- An export can reverse the one before it inside a day: the 2026-09-26
  evening frames made New project, Add a host and the automation editor
  pages over the main column, and the 2026-09-27 frames made them dialogs
  again, keeping the replaced artboards as `SessionsConsole (pages)` and
  `AddHost (cards)`. Diff the frame against the previous sync before
  reading it whole; the delta was three dialogs and one fold, and the
  export's own README named it.
- A dialog that two features open (the sidebar and the composer both open
  New project) lives in the feature whose surfaces open it, not in a
  feature named after the entity: `features/projects/` went away and its
  helpers moved to `sessions/lib/`. The state of "which dialog is up" is
  each surface's own `useState`; nothing crossed features or the URL.
- The parts two features draw identically (the two copy buttons, the
  Inspect fold) went to the kit's `hosts/` concern with a hook of their
  own (`useCopied`), because a feature may not import another. The
  design-system linter's `no-restyle` then decides where the rest goes:
  a gap on `DialogBody` or `DisclosurePanel` is a plain wrapper, a red
  ghost button is a `destructive-ghost` variant, never a class.
- Base UI's `Collapsible` and `Tabs` were enough for the fold and the
  wizard strip; the data attributes to style against are `data-panel-open`
  on the trigger and `data-active` on a tab.
