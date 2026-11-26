# Product

What Oppenheimer is, why, and how each part of it works, kept as notes.
[`brief.html`](brief.html) is the one-page version.

| Where | What it holds |
|-------|---------------|
| [`design/`](design/README.md) | How the product works, one folder per area (foundations, runner, sessions, console, automations, plan, pull requests, bots, channels, clients). Each note says what is decided, what is built and what is still open |
| [`roadmap.md`](roadmap.md) | The order of what comes next, and the questions it leaves open |
| [`decisions.md`](decisions.md) | Every decision that replaced an earlier one, dated, so nobody is misled by an older note |
| [`research/`](research/README.md) | Reads of other products, measurements and proposals not adopted; the code and captures behind them are in `research/spikes/`. A research note decides nothing |
| [`archive/`](archive/README.md) | The planning notes from before the MVP was scoped; mostly superseded, still cited as "note 04" |
| [`mockups/`](mockups/README.md) | The design exports the console's screens are built from; `version1/Flow.dc.html` is their index |

## How notes are cited

- A bare number is a numbered design note: `02 §6` is
  [`design/runner/02-runner.md`](design/runner/02-runner.md) §6. The
  numbers are unique across `design/` and never reused.
- "note 04", with the word, is a planning note in `archive/`; research notes
  that once had a number are mapped in the Formerly column of
  [`research/README.md`](research/README.md).
- A note without a number is cited by its path.

## Changing a note

- **A decision changes:** update the note that made it, add a dated line to
  [`decisions.md`](decisions.md) without rewriting the earlier lines, and keep
  `brief.html` in sync. `scripts/check-product-sync.mjs` fails a branch whose
  notes changed without both; an edit that changes no decision says so in a
  commit trailer, `Product-Sync: <why>`.
- **A new design:** a note in the area's folder of `design/` and a row in
  [`design/README.md`](design/README.md); an area that has none gets a folder.
- **Not yet placed:** a line in [`roadmap.md`](roadmap.md), and its note in
  `design/` once there is more than a sketch.
- **A read, a measurement or a spike:** a note in `research/` and a row in its
  README; code, benches and screenshots go in `research/spikes/<name>/`.
