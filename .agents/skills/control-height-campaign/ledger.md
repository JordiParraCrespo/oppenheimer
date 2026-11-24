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

## Next

- **Pass 3, the composer and chrome.** The composer's foot and
  `ComposerPill` (attach 32, emoji and send 32, dictation 30; the
  measurement's four remaining rows), the dictation field in the routine
  editor (30), the chat composer's send (32 / 34), the top bar's search
  (36px beside 34px icon buttons), the sidebar's input and search (32 / 30),
  `NumberStepper` (32 outer). Then the debt the scanner still lists.

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
