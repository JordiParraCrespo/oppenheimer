# design-system — Agent Instructions

Shared design system. This directory is a **container of two publishable
packages**:

- [`web/`](./web) → `@oppenheimer/design-system-web` — Base UI + Tailwind v4 (used by `apps/web`, `apps/web-showcase`)
- [`mobile/`](./mobile) → `@oppenheimer/design-system-mobile` — React Native + NativeWind (used by `apps/mobile`, `apps/mobile-showcase`)

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first. There is no package.json
> at this level — work inside `web/` or `mobile/`.

## The system

The source is the Claude Design export in `product/versions/mvp/design/`:
`_ds/…/tokens/*.css` for the tokens and `readme.md` for the rationale, and
the `version1/` artboards for what the screens actually do. Its one sentence:
**the product is the work, and the design system is the silence around it.**

- **Colour is rationed.** One blue for actions (`--primary`), one for links
  (`--link`). Status hues (green, amber, red) appear only as run state, never
  as decoration and never as a CTA. Everything else is achromatic. One primary
  button per view.
- **Two layers of colour.** The raw palette (`--op-gray-500`, `--op-blue-500`)
  is never referenced in product code. Semantic aliases (`--fg-muted`,
  `--card`, `--border-subtle`) re-point under `.dark` / `[data-theme="dark"]`,
  so a theme switch moves aliases only and no component holds a conditional
  colour. Dark is the version-1 artboards' lifted ramp (`#121213` canvas), not
  the export's true black.
- **One typeface.** SF Pro does every job; Display is the same family at 600
  with tighter tracking from 21px up. Weight never exceeds 600. Every number a
  human compares is SF Mono, tabular (`figures` utility).
- **One control ramp**: 28 / 34 / 42px for Button, IconButton, Input, ChipSelect.
- **Six radii and no others**: 6 · 10 · 14 · 18 · 28 · pill. Type into a 10,
  press a pill, read inside an 18.
- **Surfaces never cast shadows.** Depth is tonal. Only popovers, modals and
  glass carry one.
- **Motion** is 80 / 140 / 220 / 400ms, eased, never bouncy; a 4px rise plus
  fade for anything that appears. All durations go to 0 under reduced motion.
- **Copy** is sentence case, verb-first, no emoji. It navigates, it is a
  `Link`; it acts, it is a `Button`.

## Conventions

- **Tokens are the source of truth**: [`web/src/styles/globals.css`](./web/src/styles/globals.css).
  Palette, semantic aliases, type ladder, space, radii, elevation, motion,
  then the shadcn semantic names aliased onto them, then the Tailwind mapping
  in `@theme inline`. Change the system there; components inherit it.
- Prefer a semantic utility (`text-fg-muted`, `bg-canvas`, `border-border-subtle`,
  `rounded-pill`, `duration-fast`) over a raw value. Never a `dark:` colour
  override: the aliases already invert.
- The previous starter brand's names (`--ink-*`, `--surface-*`, `--status-*`)
  are kept as **legacy aliases** so the unported components in `apps/web`
  still render. Author nothing new against them; they go when the last
  component is ported.
- The MVP component inventory (what the nine screens need, and nothing more)
  is the showcase's table of contents: `apps/web-showcase/src/lib/toc.ts`.
  Components in `web/src/components/` not on that list are legacy from the
  starter and not part of the system.
- Preview every change in `apps/web-showcase`, in **both** themes; the top
  bar carries the switch.
- `apps/mobile/global.css` and `apps/mobile-showcase/global.css` still carry
  the previous brand. Porting the mobile tokens is its own slice.
