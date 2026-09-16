# Component recipes from the MVP port

What each component needed, and the trap it had. Read the entry before
writing the component; the measurements come from the export's
`components/*/*.css`.

## Core

- **Button** — `cva` on the pill; sizes `sm/md/lg` map to the control ramp
  via `h-(--control-h-sm)` etc. Variants `primary, secondary, ghost, outline,
  social, destructive`. Press: `active:scale-[0.975]`. Add the previous
  system's variant and size names (`default`, `inverse`, `link`, `icon*`,
  `xs`) as marked legacy aliases so unported callers type-check. `block`
  prop for full width. `nativeButton={nativeButton ?? render === undefined}`
  keeps Base UI happy when rendering an anchor.
- **IconButton** — same ramp, `size-(--control-h-*)`, `shape="square"` for
  the 10px radius inside fields/list headers; `xs` at 24px is the sidebar
  header's filter button. Type `aria-label` as a prop; keep it optional
  only while legacy callers omit it.
- **Link** — `useRender` + `mergeProps` from Base UI (typing `props` as a
  bare object fails the `Record<string, unknown>` constraint). `muted`
  variant for footer links.
- **Wordmark** — text, not an SVG: display face, 600, -0.032em; `product`
  suffix at 0.42em uppercase.
- **BrandGlyph** — inline SVG paths for GitHub (monochrome, inherits
  `currentColor`; flip on dark with `[filter:var(--brand-glyph-filter)]` when
  on a neutral fill) and Google (full colour, untouched).
- **Chip / FilterChip** — Chip renders a button only when it has `onClick`,
  otherwise a span, so read-only capability chips are not announced as
  controls. FilterChip is 22px with a remove button.
- **StatusDot** — dot + word; `completed` swaps to a check; `meta` second
  line; `pulse` for live waits (`motion-safe:animate-pulse`).
- **Avatar** — sizes sm 22 / md 28 / lg 38, `variant="accent"` for the
  signed-in account. Keep `AVATAR_GRADIENTS` exported as a legacy stub
  mapping to the accent tint; gradients are forbidden.
- **Separator** — with children it becomes the labelled "OR" rule: two
  hairlines around an eyebrow.
- **Card** — 18px, `border-subtle`, no shadow; `padded` for one block;
  header/content/footer carry `--card-padding`.
- **CodeBlock** — `'use client'`; clipboard copy with a 1.8s "Copied"; `dim`
  fades a trailing substring without changing what is copied.
- **EmptyState** — keep the compound API (`EmptyState.Header/Media/Title/
  Description/Content`); add `compact` for the sidebar line. Use a
  `group/empty` on the root so children can restyle under `data-compact`.

## Forms

- **Input** — a flex shell around the native input so `leading`/`trailing`
  fit inside the border; `ref` and every input prop go to the inner
  element, `className` styles the shell, `inputClassName` the inner one.
  Focus via `has-focus-visible:` on the shell. Add `default` as a legacy
  size alias.
- **PasswordInput** — Input with a prewired trailing toggle: `type="button"`,
  `tabIndex={-1}`, `aria-pressed`, label flips. Own the state here, never
  in screens.
- **Textarea** — 10px radius, `field-sizing-content`, min 88px.
- **Field** — keep the shadcn compound parts; add `FieldRow` (label left,
  action right) and `FieldAction` for "Forgot password?". Label 13px
  medium, description 12px subtle, error 12px danger.
- **ChipSelect** — Base UI `Select`: chip trigger (34px, 14px radius,
  control fill, icon + `Select.Value` + chevron), `data-popup-open:` for the
  ring, popover at `min-w-(--anchor-width)` with `alignItemWithTrigger=false`.
  Options are two-line with the check on the first line; `ChipSelectAction`
  is a plain button after a `Select.Separator`.
- **Composer** — controlled `value/onValueChange/onSubmit`; Enter submits,
  Shift+Enter breaks; `busy` turns send into stop; `attachments` +
  `onRemoveAttachment`; `onAttach`/`onRecord` presence shows the buttons;
  `tools` slot for the model picker.

## Overlays

- **Dialog** — Base UI Dialog; popup at 28px radius, `shadow-modal`,
  `data-starting-style`/`data-ending-style` for the 4px rise; backdrop with
  `backdrop-blur-[3px]`; close is an `IconButton` via `Dialog.Close render`.
  Keep `DialogHero`/`DialogHeroPlate`/`DialogBody` exports as flat wrappers
  for legacy screens.
- **DropdownMenu** — one shared item class; add `DropdownMenuHeader` (the
  e-mail line), `DropdownMenuValue` (facet value before the chevron),
  `description` on `RadioItem` for two-line options, `variant="destructive"`
  on items. Submenus via `SubmenuRoot/SubmenuTrigger`.
- **Tooltip** — inverted fill, 12px, 6px radius, no arrow, 300ms delay.

## Navigation

- **Sidebar** — restyle the shadcn file: width 264 / 60 collapsed, `bg-sidebar`,
  group label as eyebrow with a `SidebarGroupCount` slot, menu button at the
  10px radius with `data-active` fill. Don't rewrite it; the provider and
  mobile sheet are what the showcase shell uses.
- **SessionItem / SessionList** — 30px rows, glyph coloured by state, mono
  age visible on hover/active, `role="listitem"` inside `role="list"`.
- **Stepper** — replaces the starter's pipeline stepper entirely (it was
  unused): rail with mark and line, `running` spins a ring
  (`border-t-transparent animate-spin`), `done` fills green and greens the
  line, footer with mono elapsed and a status word.

## Terminal

- **Terminal** — `figures`, 13px/1.55 on `--term-*`; `TerminalScrollback`
  owns scroll; `TerminalLine tone=` (dim, accent, success, warning, danger,
  strong) and `command` for the blue `$`; `TerminalTurn` is the agent bullet;
  `TerminalPrompt` pinned; `TerminalStatusBar` + `TerminalStatusItem`.

## Media

- **ImageCarousel** — slides `{src, alt, caption, position}`; interval
  5200ms, fade 700ms; pause on hover/focus; reduced motion stops autoplay;
  dots are `role="tab"` buttons; the caption scrim is the only allowed
  gradient. Images from `src/assets/imagery` as WebP; the showcase copies
  them to `public/imagery`.

## Showcase pitfalls

- The page must be `'use client'`; an inline `onRemove={() => {}}` in a
  server component fails prerendering.
- `ThemePair` is a `.dark` scoped div next to a plain one; anything that
  reads tokens re-themes for free, which is the demonstration.
- Tailwind arbitrary values against a raw palette token need
  `bg-[var(--op-gray-900)]`; there is no `bg-op-*` utility by design.
