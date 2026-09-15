# @oppenheimer/design-system-web

Web component library for Oppenheimer — shadcn/ui-style components built on
[Base UI](https://base-ui.com/) primitives and Tailwind CSS v4. Consumed by
`apps/web` and previewed in `apps/web-showcase`.

## Usage

Import components from their per-component subpath (tree-shakeable) or from the
package root:

```tsx
import { Button } from "@oppenheimer/design-system-web/button";
import { Card, CardHeader, CardContent } from "@oppenheimer/design-system-web";
import { EmptyState } from "@oppenheimer/design-system-web/empty-state";
import { cn } from "@oppenheimer/design-system-web/utils";
```

Compound components expose their slots on the root component:

```tsx
<EmptyState>
  <EmptyState.Header>
    <EmptyState.Media variant="icon">
      <Globe />
    </EmptyState.Media>
    <EmptyState.Title>No domains yet</EmptyState.Title>
    <EmptyState.Description>Domains will appear here.</EmptyState.Description>
  </EmptyState.Header>
</EmptyState>
```

Wire up the styles and Tailwind preset in the consuming app:

```ts
// tailwind entry / config
import "@oppenheimer/design-system-web/styles"; // globals.css (tokens + base layer)
import preset from "@oppenheimer/design-system-web/tailwind-config";
```

## What's inside

- `src/components/*` — Button, Card, Dialog, DropdownMenu, Sidebar, Table, Tabs,
  Command, Chart (Recharts), Sonner toasts, BrandMark, and more — each with its
  own export.
- `src/hooks/use-mobile` — viewport helper.
- `src/lib/utils` — `cn()` (clsx + tailwind-merge).
- `src/styles/globals.css` — **the canonical brand definition**: primitives
  (`--ink-*`, `--surface-*`, `--accent-*`, `--status-*`, `--data-*`), the shadcn
  semantic aliases, and the Tailwind mapping (type scale, radii, flat shadow
  scale) in `@theme inline`. Both light and dark live here.
- `tailwind.config.ts` — shared preset.

The brand is monochrome-first and flat: three inks over white surfaces, hairline
borders instead of elevation, near-black pill CTAs, and colour only for status.
See [`../AGENTS.md`](../AGENTS.md) for the rules, and the showcase's
`/foundations` page for the rendered reference.

`react`, `react-dom`, and `recharts` are peer dependencies supplied by the app.

## Scripts

```bash
pnpm build   # tsup -> dist
pnpm dev     # tsup --watch
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
{ "lint:design": "oxlint -c ../../packages/design-system/web/oxlint.design.json src" }
```

Rules are at `warn` until an app's count for one reaches zero; then promote it
to `error` here and it fails CI for every consumer. The rationale for each rule
and the findings it inherited are in `.agents/rules/frontend-ui.md`.

## Consumed by

`apps/web`, `apps/web-showcase`.
