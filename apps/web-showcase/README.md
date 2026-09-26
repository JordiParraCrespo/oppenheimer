# @oppenheimer/web-showcase

A Next.js gallery of the web design system. Every component and block that
`@oppenheimer/design-system-web` exports is rendered here so it can be browsed and
reviewed visually, in light and dark, before it lands in a product screen.
It carries no product logic and talks to no API.

## Running it

```bash
pnpm --filter @oppenheimer/web-showcase dev     # http://localhost:3002
pnpm --filter @oppenheimer/web-showcase build
pnpm --filter @oppenheimer/web-showcase lint
```

The gallery reads the design system from source, but the agent catalog it
renders comes from `@oppenheimer/shared`, which resolves to that package's
`dist/`. `dev` builds it first, so a fresh clone or a pull that touched
`packages/shared` needs only `pnpm install` before it. A build or lint after
such a pull needs `pnpm --filter @oppenheimer/shared build` by hand.

## Layout

```
src/
├── app/            # Next.js App Router pages, one per component family
└── components/     # the gallery's own chrome (navigation, code panels)
```

The design system itself lives in `packages/frontend/design-system/web`; a component is
added there and then given a page here. The `/design-export-port` skill
rebuilds this gallery from a design export.

## Depends on / used by

Depends on `@oppenheimer/design-system-web` and, for the agent catalog,
`@oppenheimer/shared`. Nothing depends on it; it is an
optional app the starter prunes with `scripts/starter/features.json`.

See [`AGENTS.md`](./AGENTS.md) for the conventions.
