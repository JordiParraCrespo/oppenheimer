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
├── host-link-demos.tsx # the terminal through a host going offline and back (banner and notice forms), and the drop zones
├── feedback.tsx      # Alert, Badge, Skeleton, the toast, the command palette's parts
├── page-shell.tsx    # PageShell, PageHead, GroupHead, Spec, Swatch, ThemePair
├── app-sidebar.tsx   # the TOC with scroll-spy
└── top-bar.tsx       # search palette and theme toggle
src/lib/toc.ts        # the inventory: each item names its component files; drives the sidebar and the page order
public/imagery/       # copies of the package's carousel photographs
```

## Conventions

- Adding a component to the system means a `<Spec id>` on the page **and** a
  row in `toc.ts` whose `components` names its file; the scroll-spy matches
  on the id. The design system's `test` fails on a component file no row
  names, or one the page never imports.
- Icons come from `@oppenheimer/design-system-web/icons`, as in the apps.
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
