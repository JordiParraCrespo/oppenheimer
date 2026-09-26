# @oppenheimer/design-system-web

The web design system for Oppenheimer: tokens plus the components the MVP
screens are built from, on [Base UI](https://base-ui.com/) primitives and
Tailwind CSS v4. Consumed by `apps/web` and previewed in `apps/web-showcase`.

## Usage

Import a component from its subpath (tree-shakeable) or from the root:

```tsx
import { Button } from '@oppenheimer/design-system-web/button';
import { ChipSelect } from '@oppenheimer/design-system-web/chip-select';
import { Field, FieldLabel, PasswordInput } from '@oppenheimer/design-system-web';
```

Wire the styles into the app's CSS entry alongside Tailwind:

```css
@import 'tailwindcss';
@import '@oppenheimer/design-system-web/styles';
@source '../../../../packages/design-system/web/src/**/*.{ts,tsx}';
@custom-variant dark (&:where(.dark, .dark *, [data-theme='dark'], [data-theme='dark'] *));
```

## What's inside

- `src/styles/globals.css` — **the system**: the `--op-*` palette, the semantic
  aliases for light and dark, the type ladder, space, the control ramp, radii,
  elevation, motion, the shadcn names aliased onto them, and the Tailwind
  `@theme` mapping. Utilities: `figures` (tabular mono), `eyebrow` (the 11px
  uppercase label), `glass`, `scrollbar-thin`.
- No vendored faces: `--font-sans` / `--font-display` / `--font-mono` are the
  system stacks (SF Pro and SF Mono on Apple platforms, the platform's UI face
  elsewhere)
- `src/assets/imagery/` — the auth carousel photographs.
- `src/components/` — the MVP inventory:
  - core: `Wordmark`, `BrandGlyph`, `Button`, `IconButton`, `Link`, `Chip`,
    `FilterChip`, `StatusDot`, `Avatar`, `Separator`, `Kbd`, `Card`,
    `CodeBlock`, `EmptyState`, `SummaryCard`, `SuccessMark`, `StepHeader`,
    `AgentMark`
  - forms: `Field`, `Input`, `PasswordInput`, `SlugInput`, `Textarea`,
    `SegmentedControl`, `ChipSelect` (and its parts), `RepositorySelect`,
    `RepositoryRowList`,
    `Composer` with `ComposerToolButton`, `AgentModelSelect`, `EffortSlider`
    and `EffortPicker`, `PermissionMenu`
  - overlays: `Callout`, `Dialog`, `DropdownMenu`, `Tooltip`
  - navigation: `Rail`, `Sidebar` (with `SidebarSearch`, `SidebarProjectHeader`,
    `SidebarEmptyRow`), `SessionItem`, `RoutineItem`, `PillTabs`, `PageHeader`,
    `Stepper`
  - routines: `RunHistory`, `RoutineTable`, `RunsList`, `TemplateGrid`,
    `RoutineSteps`, `FieldSelect`, `InlineToken` (with `TriggerCard`,
    `WeekdayStrip`, `AddRow`), `TimeGrid`
  - settings: `SettingsNav`, `SettingsGroup`, `HostCard`
  - terminal: `Terminal`, `TerminalLine`, `TerminalPrompt`, `TerminalStatusBar`
    with `TerminalStatusLink`
  - media: `ImageCarousel`

  - also used by the console, not yet in the showcase: `Alert`, `Badge`,
    `BrandMark`, `Checkbox`, `Empty`, `Label`, `RadioGroup`, `SearchInput`,
    `Skeleton`, `Toaster` (sonner), `Table`, `Toggle`, and `Sheet` inside
    `Sidebar`

  Nothing else lives there: a component nothing uses is deleted.
- `src/lib/utils` — `cn()`.

The rules are in [`../AGENTS.md`](../AGENTS.md); the rendered reference is the
showcase, `pnpm --filter @oppenheimer/web-showcase dev` on port 3002.

`react` and `react-dom` are peer dependencies supplied by the app.

## Scripts

```bash
pnpm build   # tsup -> dist
pnpm dev     # tsup --watch
pnpm test    # each component is in the barrel, the package exports and the showcase
```

## Design-system lint

`oxlint.design.json` is this package's configuration for
[`@shadcn/lint`](https://github.com/shadcn-ui/lint): the rules for using its
components, owned by the package that ships them. It reads the theme from
`src/styles/globals.css`, so it knows which colours exist, and recognises
`@oppenheimer/design-system-web` imports as components, so it can tell a layout
class from a restyle. Icons are excluded — colouring a glyph is the caller's
job. Every consuming app points its `lint:design` script here:

```json
{ "lint:design": "oxlint -c ../../packages/frontend/design-system/web/oxlint.design.json src" }
```

Rules are at `warn` until an app's count for one reaches zero; then promote it
to `error` here and it fails CI for every consumer. The rationale for each rule
and the findings it inherited are in `.agents/rules/frontend-ui.md`.

## Consumed by

`apps/web`, `apps/web-showcase`, `packages/frontend/web`.
