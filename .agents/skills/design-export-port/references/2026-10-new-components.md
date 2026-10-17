# 2026-10-13: the new components of a delta export

Do not replay these. They are what one delta sync needed that the workflow
did not predict; the next export will differ.

- Export: the 2026-10-13 sync of `product/versions/mvp/design/`. Four new
  frames (`ShareSession`, `Bots`, `BotSettings`, `Chat Components`) and
  deltas on Plan, Pull requests, Add a host and Settings. The user asked for
  the new components only, built in batches with a capture of each, so the
  variants the frames ask of existing components were listed and left.
- Inventory by fan-out: one read-only agent per frame group, each told the
  package's component list and to tag every element as covered, a variant,
  or new. Their reports were the inventory; spot-check the claims that
  decide work (a rule a component's docs state, whether a dropped card was
  ever built) before trusting them.
- `Chat Components` is an inventory frame, not a screen: each row names the
  source file it was drawn from. Parsing it (row title, source, line) gave
  the family list directly; one file per family kept the folder readable.
- A frame's own `theme` prop can override the renderer's light/dark toggle:
  the light capture came back dark until `--props '…:{"theme":"light"}'`.
  It also showed the chat sits on the recessed ground in light, which
  decided the showcase surface.
- The export shipped portraits of real people as bot photos. They were not
  copied anywhere; demos draw initials. Check imagery for real people
  before vendoring it.
- Interactive states the shooter cannot reach (typing into a combobox,
  hovering a marker) were captured with a small Playwright script beside it:
  scroll the section to the top, run click / hover / type steps, shoot the
  section. A page served by a stale `next-server` answers on the port after
  a rebuild; kill the process by name, not by `next start`.
- The design-system lint counts per file: the existing demo files were at
  zero, so new demos took the ladder's names (`text-body`, `text-sm`,
  `text-xs`) and a slot (`PillGroupItem leading`) instead of restyles.
