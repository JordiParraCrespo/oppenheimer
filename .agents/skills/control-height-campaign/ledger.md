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
| 3 | The chrome; `NOT_A_CONTROL` beside the debt; the composer kept as it was | 5 | 51 | see the pass's note |
| 4 | The rest of the debt: tokens for heights already on the ramp, `NOT_A_CONTROL` for the rest | 5 | 0 | no height changed |

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

Pass 3 put the chrome on the ramp: the top bar's icon buttons lose a
redundant `size-8.5` and its search stands at 34 (from 36); `SidebarSearch`
and `SidebarInput` at 28 (from 30 and 32); `NumberStepper`'s track at 28 with
its buttons filling it (from 32). It left the composers as they were: both 28
and 34 for the buttons on the box's line looked wrong to the user, who kept
the original sizes (`.agents/answers.md`). The rows the measurement still
lists are the TODO row and the composers' lines, both below. Of the 23 the
debt lost, 5 were paid off and 18 moved to `NOT_A_CONTROL` in
`scripts/control-height-debt.mjs`, each with its reason: 8 that are not
controls and the composers' 10.

Pass 4 changed no height. 12 controls already at 28 or 34 took the token
(chat suggestions and chips, the tray and viewed buttons, the effort slider,
the editor's back link, the task board's foot row and card button); 34 moved
to `NOT_A_CONTROL` with their reasons (sidebar and navigation rows, calendar
and time-grid cells, glyphs inside a field or a chip, the switch's track, the
reaction strip, the `xs` rung). The 4 chat chips off the ramp stay as they are, the user's call; they joined
`NOT_A_CONTROL` too, and the debt is empty.

## Next

The debt is empty. The campaign continues only through its guard: a new
control off the ramp fails `pnpm check:control-heights`, and a row found at
mixed heights is a pass of its own, measured, shown to the user before any
look changes, and recorded here.

## Open calls

- **Four small chat chips off the ramp** (the avatar picker's Shuffle 30, a
  subagent card's Stop all 24, a reply's source pill 26, a chat error's
  action 26). Decided by the user (pass 4): kept as they are, in
  `NOT_A_CONTROL`.

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
- **The composers' buttons and band** (`composer.tsx`, `chat-composer.tsx`,
  `chat-composer-extras.tsx`, `chat-composer-stack.tsx`,
  `composer-emoji-button.tsx`, in
  `NOT_A_CONTROL`): not a matter of kind but the user's call; the composer
  keeps its own sizes. The measurement lists its line as a mixed row; leave it.
