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
