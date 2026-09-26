# @oppenheimer/web-showcase — Agent Instructions

Next.js showcase for the **web** design system: the foundations and every
component the MVP screens are built from, in both themes.

> Read the root [`CLAUDE.md`](../../CLAUDE.md) and
> [`packages/frontend/design-system/AGENTS.md`](../../packages/frontend/design-system/AGENTS.md) first.

## Layout

```
src/app/
├── layout.tsx        # sidebar + top bar shell, pre-paint theme script
├── page.tsx          # the inventory, one <Spec> per entry, in TOC order
└── globals.css       # tailwind + the package styles + the dark variant
src/components/
├── foundations.tsx   # colours, type ladder, space, radii, elevation, motion, icons
├── demos.tsx         # interactive demos (menus, the Add host dialog, scope chips, slug field, composer, sidebar, terminal, carousel)
├── page-shell.tsx    # PageShell, PageHead, GroupHead, Spec, Swatch, ThemePair
├── app-sidebar.tsx   # the TOC with scroll-spy
└── top-bar.tsx       # search palette and theme toggle
src/lib/toc.ts        # the inventory; drives the sidebar and the page order
public/imagery/       # copies of the package's carousel photographs
```

## Conventions

- Adding a component to the system means a `<Spec id>` on the page **and** a
  row in `toc.ts`; the scroll-spy matches on the id.
- Show every state the screens use, in both themes where colour matters
  (`ThemePair` renders the same markup light and dark side by side).
- The page is a client component: demos hold state and pass handlers.
- Biome does not lint this app (excluded in the root `biome.json`); the
  design-system lint does: `pnpm lint:design`.

## Commands

```bash
pnpm --filter @oppenheimer/web-showcase dev    # port 3002
pnpm --filter @oppenheimer/web-showcase build
```

See [`.agents/rules/frontend-ui.md`](../../.agents/rules/frontend-ui.md) for the design-system rules this gallery demonstrates.
