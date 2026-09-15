# design-system — Agent Instructions

Shared design system. This directory is a **container of two publishable
packages** plus shared tokens:

- [`web/`](./web) → `@oppenheimer/design-system-web` — shadcn + Tailwind (used by `apps/web`, `apps/web-showcase`)
- [`mobile/`](./mobile) → `@oppenheimer/design-system-mobile` — React Native + NativeWind (used by `apps/mobile`, `apps/mobile-showcase`)

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first. There is no package.json
> at this level — work inside `web/` or `mobile/`.

## The brand

Oppenheimer: a **monochrome-first, flat** productivity aesthetic. The rules that
decide most design questions here:

- **Three inks carry the whole hierarchy** — `#292929` primary, `#5D5D5D`
  secondary, `#9E9E9E` tertiary — over white cards and a warm off-white canvas
  (`#F6F5F3`). Hierarchy comes from ink and weight, never from size alone.
- **Colour is a status signal, never decoration.** Blue `#2F80F6` (counts,
  toggles-on), cyan `#12B5CE` (live), pink `#EF3A6B` ("New"), purple `#7A5CFF`
  (avatars), plus the tinted active/paused/ended/draft pills. A coloured button
  or a coloured heading is a bug.
- **No elevation.** Cards, tiles and controls carry _no_ shadow — a hairline
  border and a surface-colour step do the work. Only genuinely floating layers
  (dialogs, menus, popovers) get depth, and only softly. `--shadow-sm`/`-md` are
  deliberately `none`.
- **Type is SF Pro at 400/500 only**, tracked -0.15px, in four sizes:
  12 (labels/badges), 13 (nav/meta), 14 (body/buttons/rows), 24 (headings).
  There is no bold — `font-bold` maps to 500.
- **Three radii plus the pill**: 8px controls, 12px tiles, 16px cards, and a
  pill for every CTA, chip, toggle and count badge.
- **Copy is sentence case and verb-first** ("Connect device", "New task"). No
  emoji, no Title Case buttons.

## Conventions

- **Design tokens are the shared source of truth.**
  [`web/src/styles/globals.css`](./web/src/styles/globals.css) is the canonical
  definition: brand primitives (`--ink-*`, `--surface-*`, `--accent-*`,
  `--status-*`, `--data-*`) first, then the shadcn semantic names aliased onto
  them, then the Tailwind mapping in `@theme inline`. Change the brand there;
  components should inherit it without edits.
- `apps/mobile/global.css` and `apps/mobile-showcase/global.css` mirror those
  tokens in the bare-HSL form NativeWind needs. They differ on purpose in two
  ways: hairlines are flattened to solid values (React Native cannot composite
  an rgba border), and every token is a literal triple rather than a `var()`
  alias (NativeWind resolves these at build time). **Keep all three in sync.**
- Prefer a **token** over a hardcoded value, and a **brand primitive**
  (`text-ink-400`, `bg-surface-sunken`) over a raw hex.
- The **shadcn component API is mirrored in the mobile package** — a component's
  props/variants should match across web and mobile so consumers get a
  consistent API on both platforms.
- Preview components in the matching showcase app (`apps/web-showcase` /
  `apps/mobile-showcase`) when adding or changing them. The web showcase's
  **Foundations** page (`/foundations`) is the reference surface; check changes
  in **both** light and dark — the sidebar carries the theme switch.
