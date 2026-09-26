# @oppenheimer/design-system-web — Agent Instructions

Web UI component library: shadcn/ui components + Tailwind, built with tsup.
Consumed by `apps/web`, `apps/web-showcase` and `packages/frontend/web`.

> Read the root [`CLAUDE.md`](../../../../CLAUDE.md) and the design-system overview
> in [`../AGENTS.md`](../AGENTS.md) first.

## Layout

```
src/
├── components/   # the public components: one file each, all in the barrel
├── internal/     # building blocks only components import; not exported
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
- **Adding a component** is a file in `src/components/`, its exports in
  `src/index.ts` (`apps/web` imports from the root), and a `<Spec>` on the
  showcase page with the file name in that `toc.ts` item's `components`.
  `package.json` needs nothing: `./*` maps every file to its subpath.
  `pnpm test` (`scripts/check-exports.mjs`) fails until all of it is there.
- **A building block** that only other components use goes in
  `src/internal/`, stays out of the barrel and off the showcase, and is
  imported as `../internal/<name>`.
- **Removing one**: when the last caller goes, delete the file and its barrel
  lines in the same change. The test fails on an internal file nothing
  imports and on a public one the showcase no longer lists.

## Commands

```bash
pnpm --filter @oppenheimer/design-system-web build
pnpm --filter @oppenheimer/design-system-web dev
pnpm --filter @oppenheimer/design-system-web test   # barrel, subpaths and showcase coverage
```

See [`.agents/rules/frontend-ui.md`](../../../../.agents/rules/frontend-ui.md) for how the apps consume these components.
