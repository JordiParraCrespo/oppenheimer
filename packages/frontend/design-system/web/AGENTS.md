# @oppenheimer/design-system-web — Agent Instructions

Web UI component library: shadcn/ui components + Tailwind, built with tsup.
Consumed by `apps/web`, `apps/web-showcase` and `packages/frontend/web`.

> Read the root [`CLAUDE.md`](../../../../CLAUDE.md) and the design-system overview
> in [`../AGENTS.md`](../AGENTS.md) first.

## Layout

```
src/
├── components/   # shadcn-based components
├── hooks/        # generic React hooks (useControlled, useDebouncedValue, …), exported from index.ts
├── lib/          # utils (cn, variants, etc.)
├── styles/       # shared styles
└── index.ts      # public exports
tailwind.config.ts
tsup.config.ts    # build config
```

## Conventions

- Components follow **shadcn** conventions.
- Colors/spacing/typography come from the shared design tokens — don't hardcode.
- **Export new components from `index.ts`.** This is enforced:
  `scripts/check-exports.mjs` runs as the package's `test` script and fails the
  build when a file in `src/components/` exports something the barrel does not.
  Every component also has a `./name` subpath in package.json, and the two
  consumers use different ones: `apps/web-showcase` imports each component by
  subpath, while `apps/web` takes components from the root and only icons by
  subpath. So a missing barrel entry does not break the showcase — it just
  makes the component invisible to the product app, which is how `Breadcrumb`
  and `Collapsible` sat unused until an audit went looking, by which time a
  screen had hand-rolled a breadcrumb.
  If something must stay internal, do not export it from its own module either.
- Preview new components in `apps/web-showcase`.

## Commands

```bash
pnpm --filter @oppenheimer/design-system-web build
pnpm --filter @oppenheimer/design-system-web dev
pnpm --filter @oppenheimer/design-system-web test   # the barrel-export check
```

See [`.agents/rules/frontend-ui.md`](../../../../.agents/rules/frontend-ui.md) for how the apps consume these components.
