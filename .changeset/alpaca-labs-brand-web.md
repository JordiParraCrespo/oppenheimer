---
"@oppenheimer/design-system-web": minor
---

Rebrand the design system onto the Alpaca Labs visual language, on both web and
mobile.

The system is now **monochrome-first and flat**: three neutral inks
(`#292929` / `#5D5D5D` / `#9E9E9E`) over white and warm off-white surfaces,
hairline borders carrying the structure instead of elevation, near-black pill
CTAs, and colour reserved for status. Type is the system stack (SF Pro on Apple platforms, nothing vendored) at 400/500 with
-0.15px tracking across four sizes (12/13/14/24). Radii collapse to the three
the brand allows — 8px controls, 12px tiles, 16px cards — plus the pill.

Most of this lands in the **token layer**, so components inherit the brand
without knowing about it. `packages/frontend/design-system/web/src/styles/globals.css`
is now the single source of truth: it declares the brand primitives
(`--ink-*`, `--surface-*`, `--accent-*`, `--status-*`, `--data-*`), aliases the
shadcn semantic names onto them, and maps everything into Tailwind through
`@theme inline` — including the type scale, the 400/500 weight cap, the radius
scale, and a shadow scale where the inline steps are `none` and only `lg`/`xl`
(floating layers) carry depth. `apps/web` and `apps/web-showcase` now import
that file instead of each keeping their own copy of the palette, which is what
had let the two drift apart.

Dark mode is a first-class part of the brand rather than an inversion: a warm
near-black canvas (`#161513`) with its own chrome, surface and hairline ramp.
Both `.dark` and `[data-theme='dark']` activate it.

Component changes are the ones the tokens cannot express: pill buttons with a
0.98 press and a new `inverse` variant (the white pill used on dark cards),
16px flat cards padded to 16px, blue `count` / pink `new` / tinted
active·paused·ended·draft badge variants, blue switches and checkboxes over
hairline outlines, 13px tertiary-ink table headers, and a sidebar rebuilt to the
brand's anatomy — 244px wide, 8px nav rows that fill with `--surface-sunken`
when active, and blue count pills in the trailing slot. A new `BrandMark`
component ships the geometric eight-arm asterisk.

`CommandDialog` gains the `<Command>` wrapper it was missing. Without it the
children (`CommandInput`, `CommandList`, …) read cmdk's context before any
provider exists and throw on mount, so the component could not be used at all —
nothing in the repo had tried yet.

Sixteen components are added to close the gap against the brand's own
component inventory: `Tag` (the category chip), `SearchInput`, `SelectMenu`
(the toolbar filter, distinct from the form `Select`), `AsyncMultiSelect` (a
debounced, windowed typeahead for fields with thousands of options),
`DeltaText`,
`Sparkline`, `Kpi`/`KpiCard`, `BreakdownRow`/`TopItemRow`, `Stepper`,
`AgentCard`, `AppIcon`/`AppTile`, `FeatureRow`, `RecentItem`, `PromptCard`,
`ChatBubble` and `Composer`. `AppIcon` fetches third-party marks from the
Iconify API as the brand guide specifies, and takes a `src` override for
serving them yourself.

`Label` drops to 13px regular in secondary ink — the brand's field label,
rather than shadcn's 14px medium.

The showcase was then verified **against the brand's own exported design-system
page**, section by section, on rendered geometry rather than by eye: 40 of its
41 entries match the reference's demo area to the pixel, and their colour sets
match exactly. Getting there surfaced several real defects in this
implementation — the type scale carried implicit line-heights (and Tailwind's
preflight put 1.5 on `<html>`), inflating every control and row by a few pixels;
`Tag` inherited that leading and stood 7px too tall; `Badge` counted a
transparent border into its width; `Avatar` scaled its initial with a CSS
`calc` instead of the brand's whole-pixel rounding; `Input`, `Select`,
`Checkbox` and `RadioGroup` were each a size off; and the type specimens
referenced `--text-24`-style tokens the layer never defined, so they silently
rendered at 14px.

Line-height is now applied deliberately rather than implied by a size, and the
brand's `--text-12/13/14/24` aliases exist alongside the Tailwind scale.

`apps/web-showcase` is rebuilt on the product's own shell so the brand can be
checked the way it will actually be seen: the 56px topbar (sidebar toggle,
centred ⌘K search wired to a real command palette, theme switch, notifications,
avatar), and the dashboard's page metrics — 44px/48px/64px padding on a centred
1080px measure, a 24px PageHead over a 14px secondary line. The component
gallery follows the design's own inventory pattern: a 24px title with its source
in mono, a one-line description, then the live demo on the sunken canvas inside
a flat card with the usage line in a hairline-divided footer. A new
**Foundations** page covers colours, type, radius, elevation, CTAs, status and a
table in context, and the component gallery now carries all 42 entries the
brand's inventory documents — core, forms, overlays, data, patterns, product,
navigation and the assistant.

**Overlay pass.** Every floating layer was measured against the reference and
brought onto its exact metrics. The brand turns out to use four distinct
overlay shadows rather than one, and they are now applied per surface: menus
`0 8px 28px rgba(0,0,0,.10)`, the toolbar select menu `0 10px 30px
rgba(20,20,22,.12)`, filter and autocomplete panels `0 12px 34px` / `0 10px
34px`, and the command palette `0 24px 60px rgba(20,20,22,.24)`. All of them
now open 6px below their trigger and draw their hairline as a real border
rather than an outset ring, which had been painting menus 2px wider than the
width they declared.

Specific fixes:

- `Popover` — `gap-0` is now the default. A popover is most often a menu, and
  the previous 16px gap between children pushed every list built on it (the
  table's stage filter and per-row actions, the status filter, the select menu)
  into loose, oversized rows. Popovers that genuinely stack content set their
  own spacing.
- `DropdownMenu` — 6px offset, bordered hairline. `DropdownMenu`
  rows drop to the brand's 33px height (`8/10` padding, 15px icons, regular
  weight) and the menu sizes to its own content instead of the trigger's width.
- `SelectMenu` — the trigger is the medium pill it was always meant to be
  (36px, `10/22`, 8px gap, 14px chevron), and the menu no longer inherits the
  popover's content gap, so its rows stack contiguously.
- `AsyncMultiSelect` — 36px search field, always-present "N selected / Clear"
  footer, corrected chip padding and 14px chevron.
- `Dialog` — 460px sheet, 24px heading, body-size description, a dimmed but
  **unblurred** backdrop (`rgba(20,20,20,.28)`), no drop shadow, and a 28px
  circular close inset 14px.
- `Switch` — corrected to the brand's 44x26 track with a 22px circular knob; it
  had been a 44x20 track with a 24x16 oblong.
- `Command` — 560px palette hanging at 14vh, a 52px search band with an `esc`
  chip, 44px rows carrying a new `CommandItemIcon` plate, and the return glyph
  on the active row. Also fixes a real bug: the selected styles keyed on the
  presence of `data-selected`, which cmdk writes as `"false"` on every inactive
  row, so **every** row rendered as selected.

Two reference details were deliberately not copied, both artefacts rather than
design: its autocomplete rows and menu buttons render in Arial at default
tracking (a `<button>` never inherits `font-family`), and it drifts across three
near-blacks (`#2A2926`, `#292929`, `#1D1D1F`) where this system keeps one ink.

The filter menu's dark checkbox was scaled from 26px to the form checkbox's
18px footprint (radius 5, 11px check). The reference draws it at 26px, which
puts its rows at 42px — noticeably heavier than every other menu on the page,
and out of proportion with the checkboxes directly below it in the same view.
All filter rows now sit on the shared 34px rhythm.

`SelectMenu` gains a `variant`. `pill` is the bordered filter chip that sits on
a page toolbar (unchanged, and the default); `ghost` is a compact borderless
trigger — 28px, `6/9` padding, 13px secondary ink, 14px leading icon — for use
inside a control that already has its own frame, where a second border would
read as a box inside a box. The composer's model picker is the first consumer;
the reference draws that chip but leaves it inert, so the trigger metrics are
its and the menu is the brand's.

New `Kbd` component for the ⌘K shortcut chip, replacing the ad-hoc `<kbd>`
markup the topbar search and palette trigger each carried. A bare `<kbd>` picks
up the UA's monospace face, which renders ⌘ and the letter at visibly different
widths from the rest of the interface, and it inherited the brand's -0.15px
tracking, which crowds a two-glyph chip. `Kbd` pins the sans stack, `tracking-wide`
(the 0px step — `tracking-normal` is mapped to the brand's -0.15px) and a 13px
line box, landing on the reference's 31x19.

`Alert` gains a callout per status — `active`, `paused`, `ended`, `draft` —
reusing `Badge`'s vocabulary rather than introducing a second one
(success/warning/info) for the same four tones. Each colours the icon, the
title and the description, and tints the hairline to the status hue at 25%
opacity; the surface stays the flat card. A full-bleed tint works on a status
pill because the pill *is* the signal, but across a callout-sized surface it
becomes decoration, which the brand does not do. `destructive` is unchanged and
remains the shadcn-standard alias for the same red as `ended`.

Five chat components added from the shadcn `base-vega` registry — `Attachment`,
`Bubble`, `Message`, `MessageScroller` and `Questionnaire` (43 exports), with
`@shadcn/react` as a new runtime dependency for the scroller and questionnaire
primitives. Three brand corrections were applied on the way in: `rounded-lg`
(10px) is not one of the brand's radii, so the xs attachment and its media
thumb drop to 8px; the questionnaire's choice indicator moves from 4px to the
5px the form `Checkbox` uses. Their `shadow-xs` needed no change — that step is
already `none` in this scale.

`Skeleton` moves off `bg-muted`. The sunken well is #F1F0EE and the specimen
canvas is #F6F5F3 — five units apart, so the placeholder was nearly invisible.
It now uses `track-off`, the brand's existing inactive-fill neutral, which
reads on both card and canvas and already carries a dark-mode value.

Selection is now one colour across the system. The questionnaire's choice
indicator and the filter menu's checkbox both inherited `--primary` — the
near-black CTA colour — while `Checkbox` and `RadioGroup` had always used the
brand's blue. Blue is the brand's selection accent (counts, toggles-on), so
both move to `accent-blue`, with the questionnaire's selected card picking up a
blue hairline to match.
