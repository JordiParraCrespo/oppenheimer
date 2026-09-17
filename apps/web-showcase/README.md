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

Depends on `@oppenheimer/design-system-web`. Nothing depends on it; it is an
optional app the starter prunes with `scripts/starter/features.json`.

See [`AGENTS.md`](./AGENTS.md) for the conventions.
