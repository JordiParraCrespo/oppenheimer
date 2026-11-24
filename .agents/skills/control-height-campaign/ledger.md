# Control-height campaign ledger

Where the campaign stands. "Rows" is the measurement's count of rows whose
controls differ in height, over the routes the spec visits; "Census" is every
control height it saw; "Debt" is `scripts/control-height-debt.mjs`'s total.
A pass's census is over the routes its spec visited, so a pass that adds
routes counts more controls.

## Passes

| Pass | Scope | Rows | Debt | Census (px × controls) |
| --- | --- | --- | --- | --- |
| Baseline (2026-11-24) | — | 18 | — | 24×8 · 27×10 · 28×107 · 30×33 · 32×36 · 34×23 · 36×14 · 40×2 |
| 1 | The design-system primitives onto the ramp; the check; Permissions and Automations rows | 10 | 80 | 24×8 · 27×10 · 28×134 · 30×5 · 32×20 · 34×40 · 36×14 · 42×1 |
| 2 | The console's rows; the spec adds a plan with tasks, `/about` and the routine editor | 5 | 74 | 24×2 · 27×10 · 28×148 · 30×6 · 32×20 · 34×56 · 36×14 · 42×2 |
| 3 | The composer and the chrome; `NOT_A_CONTROL` beside the debt | 1 | 52 | 24×2 · 27×10 · 28×166 · 32×8 · 34×56 · 36×14 · 42×2 |

Pass 1 put on the ramp: `SegmentedControl`'s track (sm 28, md 34, lg 42,
from about 27 / 32 / 40), `PillTabs` md (34, from 32), `PillGroup` and
`FacetSelect`'s `pill` (28, from 30), `FieldSelect`'s `quiet` (28, from 32),
`ChipSelectTrigger`'s `tab` and `ComposerToolButton` (28, from 30),
`SettingsAddRow`'s field (28, from 32), `Chip` sm (the token). Rows that
came level with them: Plan's, Calendar's and add-to-day's filters, a bot's
tool rows, Telegram's and WhatsApp's chat bars, the rule and fact add rows,
the composer's scope band. Fixed by the caller: a bot's tool search (md,
level with its 34px facets) and Automations' New automation (md, level with
its tabs).

Pass 2 levelled each row by its caller's `size`: Calendar's and Milestones'
headers at 34 (Today and the arrows, from 28); a pull request's toolbar at 28
(Unified / Split, Open on GitHub and Submit review, from 34, level with the
page bar's sidebar toggle and back); the Inbox header at 28 (Refresh and
Filter, from `xs` 24); Add host's Command / Agent prompt tabs at 28 (from 23);
the routine editor's step tabs at 28 in a 34px track (from 30 in 36); the
public header at 28 (language and theme, from 34 and 30); `InlineToken`, the
trigger card's glyph and its duplicate and remove buttons at 28 (from 30).
The project page needed nothing: main's PillTabs move put it at 34 beside
its 34px date range.

Pass 3 put the composers on the 28 rung with their foot's tool buttons:
`Composer`'s and `ComposerPill`'s attach, emoji, mic and send (from 30 and
32), `ChatComposer`'s attach and send (from 30, 32 and 34), the context meter
(the token). The chrome: the top bar's icon buttons lose a redundant
`size-8.5` and its search stands at 34 (from 36); `SidebarSearch` and
`SidebarInput` at 28 (from 30 and 32); `NumberStepper`'s track at 28 with its
buttons filling it (from 32). The one row the measurement still lists is the
TODO row below. 8 of the 22 the debt lost were not controls, and moved to
`NOT_A_CONTROL` in `scripts/control-height-debt.mjs`, each with its reason.

## Next

- **Pass 4, the remaining debt** (52, `node scripts/control-heights.mjs
  --list`), file by file, each either onto the ramp or into `NOT_A_CONTROL`
  with its reason. The measurement's census names the visible ones: a bot's
  Profile pickers (colour swatches 32, faces 36: grids of choices, likely not
  controls), the composer band's actions (`ComposerStackAction`, 24), TODO's
  add field (36), a Calendar button (40), and the chat's pieces (`chat-*`:
  suggestions, status, transcript jumps).
- **The inline composers grow 2px while dictating** (`ComposerPill` and
  the inline `ChatComposer`: 46 to 48px, measured on main before pass 3): the
  recorder bar is 2px taller than the line it replaces.

## Open calls

- **`xs` buttons (24px).** Decided by default (the user kept it): an `xs`
  moves to `sm` where it stands beside a `sm` control (the Inbox header, pass
  2). One that stands alone (a sidebar row's menu, a message's copy) keeps
  `xs`; the ramp does not grow an `xs` rung.
- **`InlineToken` (30px).** Decided by default (the user kept it): every
  token stands at 28 (pass 2).

## Not a control

Things the measurement or the scanner lists that are not controls standing in
a row of controls, and stay:

- **A TODO row's title and drag handle** (`/plan/todo`): the title is the
  row's text as a button (23.5px, a line of type) and the handle is the whole
  row's height (44px); the row's own actions beside them are 28.
- **A disclosure's head** (27px, `disclosure-trigger`): a label row that
  folds, read as text, never beside a control.
- **The sidebar's menu buttons, row action and search clear** (`sidebar.tsx`,
  in `NOT_A_CONTROL`): rows of the navigation list and glyphs inside a row or
  a field.
- **The emoji picker's cells and category tabs** (`emoji-picker.tsx`, in
  `NOT_A_CONTROL`): a grid of glyphs and the strip above it.
