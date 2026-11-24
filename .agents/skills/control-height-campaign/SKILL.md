---
name: control-height-campaign
description: "Repo-wide campaign that puts every interactive control in the console (buttons, fields, selects, tabs, pills, segmented controls, composer buttons) on the one height ramp, 28 / 34 / 42px, so every row of controls stands at one height. Pass by pass, each with a ledger row and a pull request. Use when asked to run, continue or plan the control-height campaign, to unify input, select or button heights, or when a row of controls is found at mixed heights."
---

# Control-height campaign

The design system has one height ramp for everything you press or type into:
`--control-h-sm` 28px, `--control-h-md` 34px, `--control-h-lg` 42px
(`packages/frontend/design-system/web/src/styles/globals.css`). A control
stands on a rung, and **a row of controls stands on one rung**: a search, a
select and a button side by side are the same height. The user chose the
strict reading: no 30 or 32px controls; a 30 or 32 snaps to 28 or 34 by the
row it stands in (`.agents/answers.md`, 2026-11-24).

`ledger.md` beside this file is where the campaign stands: what each pass
covered, the debt left, and the open calls.

## The two guards

- **`pnpm check:control-heights`** (`scripts/control-heights.mjs`, in
  `ci:local`'s lint job) finds a control whose height is written by hand
  (`h-8`, `size-[30px]`, `group-data-[size=md]/tabs:h-8`) instead of
  `h-(--control-h-*)`, `size-(--control-h-*)` or a component's `size`. It
  reads the syntax tree: a class string is a control's when its unit (the
  `className` it sits in, or the variable or return that holds it) is a
  control's element or styles a control's state, never by what text is near
  it. A miss or a false hit is fixed in that rule, not with a special case.
  `scripts/control-height-debt.mjs` holds each file to the count it had; a
  pass lowers counts there as it pays them off, and never raises one.
- **The measurement** (below) reads real heights off the running console,
  which the scanner cannot: a row mixing a `sm` input with a `md` select
  passes the scanner, since both use the ramp.

## A pass

1. **Measure.** Bring the stack up (`/local-stack`, `--web`), write the
   measuring spec to `e2e/tests/screens/local/control-heights.spec.ts` (the
   spec in "Measuring" below), run `pnpm screens spec:control-heights`, and
   read `.screenshots/control-heights.json`: per route, every row whose
   controls differ, and the census of every height seen. Then
   `node scripts/control-heights.mjs --list` for the hand-written ones.
2. **Pick the pass's scope** from the ledger's "Next" list: one layer (the
   design-system primitives, the console's rows, the composer and chrome)
   so the pull request reviews as one idea.
3. **Fix, by the rules below.** Then lower the counts in the debt map
   (`node scripts/control-heights.mjs` names each file that came down).
4. **Measure again**: the rows the pass fixed are gone from the report,
   and no new ones appear.
5. **Record**: the pass's row in `ledger.md`, its census before and after,
   and what moved to "Next" or "Open calls".
6. **Ship**: one `propose` pull request per pass, driven by
   `.agents/skills/steward/SKILL.md`, light and dark screenshots of every
   route whose rows changed.

## The rules a fix follows

- **A component's height is a rung.** A variant or size map sets
  `h-(--control-h-sm|md|lg)` (or `size-(…)` for a square), never a number.
  A track that holds items (SegmentedControl) is the box that stands on the
  rung; its items fill it.
- **A row picks one rung, and the caller says which** through each
  control's `size`: a filter row of pills is `sm`; a form, a page's header
  actions and a table's filter row are `md`. A height a component has of its
  own and the caller cannot change is the bug.
- **A skeleton stands in at the height of what loads**: when a control
  moves rungs, its placeholder moves with it (`h-(--control-h-*)`).
- **Not a control, not this campaign**: list rows, table rows, calendar
  cells, a switch's track, a glyph inside a control. When the scanner lists
  one, record it in the ledger's "Not a control" list with the reason. Do not
  bend the scanner around it.
- **Change a control's look only as much as the rung needs.** Padding and
  type stay unless the new height makes them wrong.

## Measuring

The spec signs in as a fresh account, pairs a fake host, makes one bot,
visits each route at 1440px, and for each flex row groups the visible
controls (buttons, fields, selects, tabs, segmented tracks, `data-slot`
triggers; not the sidebar, menus or dialogs) whose centres sit within 6px
of each other. A row whose heights differ by 1px or more is reported. Keep it
in `e2e/tests/screens/local/` (git-ignored); the copy in
`measure.spec.ts` beside this file is the one to start from. Add routes as
the console grows; states an empty account cannot reach (a pull request's
page, a plan with tasks) are a throwaway spec of their own, as
`/local-stack` describes.
