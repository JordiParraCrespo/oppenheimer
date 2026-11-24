# Control-height campaign ledger

Where the campaign stands. "Rows" is the measurement's count of rows whose
controls differ in height, over the routes the spec visits; "Census" is every
control height it saw; "Debt" is `scripts/control-height-debt.mjs`'s total.

## Passes

| Pass | Scope | Rows | Debt | Census (px × controls) |
| --- | --- | --- | --- | --- |
| Baseline (2026-11-24) | — | 18 | — | 24×8 · 27×10 · 28×107 · 30×33 · 32×36 · 34×23 · 36×14 · 40×2 |
| 1 | The design-system primitives onto the ramp; the check; Permissions and Automations rows | 10 | 86 | 24×8 · 27×10 · 28×134 · 30×5 · 32×20 · 34×40 · 36×14 · 42×1 |

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

## Next

- **Pass 2, the console's rows.** Calendar's header (34px view switch and
  New event beside 28px Today and arrows), Milestones' header (28 / 34), a
  pull request's toolbar (28px back and sidebar toggle beside 34px
  segmented and Open on GitHub), the project page (28px segmented beside a
  34px `DateRangePicker`), the Inbox header (24px `xs` buttons beside the
  28px sidebar toggle), the code block's tabs (23px beside a 28px Copy),
  `editor-step-tabs.tsx` (30px), the public header (34 / 30 / 28,
  `theme-toggle.tsx`).
- **Pass 3, the composer and chrome.** The composer's foot and
  `ComposerPill` (attach 30, emoji and send 32, dictation 30), the chat
  composer's send (32 / 34), the top bar's search (36px beside 34px icon
  buttons), the sidebar's input and search (32 / 30), `NumberStepper` (32
  outer).

## Open calls

- **`xs` buttons (24px).** `Button` and `IconButton` have an `xs` rung
  below the ramp, used in dense headers (the Inbox). Either the ramp grows
  an `xs` (24) for in-row glyph actions, or they move to `sm`. Default:
  move them to `sm` where they stand beside a `sm` control.
- **`InlineToken` md (30px).** It stands inside a sentence
  (`TokenSentence`), not a row of controls. Default: `sm` (28) for every
  token, since the sentence reads as one line of type.

## Not a control

Things the scanner lists that are not controls standing in a row, and stay:

- (none recorded yet)
