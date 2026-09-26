# @oppenheimer/design-system-web — Agent Instructions

Web UI component library: shadcn/ui components + Tailwind, built with tsup.
Consumed by `apps/web`, `apps/web-showcase` and `packages/frontend/web`.

> Read the root [`CLAUDE.md`](../../../../CLAUDE.md) and the design-system overview
> in [`../AGENTS.md`](../AGENTS.md) first.

## Layout

```
src/
├── components/   # shadcn-based components
├── hooks/        # UI hooks
├── lib/          # utils (cn, variants, etc.)
├── styles/       # shared styles
└── index.ts      # public exports
tailwind.config.ts
tsup.config.ts    # build config
```

## Conventions

- Components follow **shadcn** conventions.
- Colors/spacing/typography come from the shared design tokens — don't hardcode.
- **A component is registered in three places, and `test` holds all three to
  the folder.** `scripts/check-exports.mjs` fails when a file in
  `src/components/` exports something `index.ts` does not, when `package.json`
  `exports` lacks its `./name` subpath (or keeps one for a deleted file), or
  when `apps/web-showcase` does not import it and it is not in
  `NOT_IN_SHOWCASE`. The two consumers use different entry points:
  `apps/web-showcase` imports each component by subpath, while `apps/web` takes components from the root and only icons by
  subpath. So a missing barrel entry does not break the showcase — it just
  makes the component invisible to the product app, which is how `Breadcrumb`
  and `Collapsible` sat unused until an audit went looking, by which time a
  screen had hand-rolled a breadcrumb.
  If something must stay internal, do not export it from its own module either.
- **Every file here is part of the system.** Preview a new component in
  `apps/web-showcase`. When the last caller of a component goes, delete the
  component, its subpath and its barrel entry in the same change.

## Commands

```bash
pnpm --filter @oppenheimer/design-system-web build
pnpm --filter @oppenheimer/design-system-web dev
pnpm --filter @oppenheimer/design-system-web test   # barrel, subpaths and showcase coverage
```

See [`.agents/rules/frontend-ui.md`](../../../../.agents/rules/frontend-ui.md) for how the apps consume these components.
