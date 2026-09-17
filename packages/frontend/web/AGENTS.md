# @oppenheimer/frontend-web — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

What both Vite apps share below their routes, organised by concern. The
concern map, the layering and the "add a concern" cookbook are
[`ARCHITECTURE.md`](ARCHITECTURE.md); the tier's layer model is
[`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Where things go

- A component both Vite apps render → `src/<concern>/components/`, exported
  by name from `src/<concern>/index.ts`. A dialog goes in `dialogs/`, a hook
  in `hooks/`, a pure helper in `lib/` (no JSX there).
- A new concern → `src/<concern>/` with only the kind directories it needs,
  an `index.ts` naming what is public, `export * from './<concern>'` in
  `src/index.ts`, and the concern's name in the `leaves`, `middle` or `top`
  list of [`.dependency-cruiser.cjs`](.dependency-cruiser.cjs). Add it to
  `sideEffects` in `package.json` only if it runs code at import.
- Something only one app needs → it stays in that app's
  `features/<module>/<kind>/`. It moves here when the second app asks for it.
- A hook over a product package's data → not here. It is a feature in the
  app; the kit may hold the presentational half.

## Before pushing

```bash
pnpm --filter @oppenheimer/frontend-web lint
pnpm --filter @oppenheimer/frontend-web test
pnpm --filter @oppenheimer/frontend-web arch
pnpm --filter @oppenheimer/frontend-web typecheck   # source-exported: no dist to build
```

## Patterns agents get wrong

- Importing `@oppenheimer/frontend-consumer` or `@oppenheimer/frontend-admin` to finish a
  component. `kit-knows-no-product` fails; take the data as props, or leave
  the component in the app.
- Reaching into another concern's file (`../table/hooks/use-table-query`).
  Concerns meet at their `index.ts` — `concerns-meet-at-their-index`.
- Importing `shell` or `auth` from a leaf like `theme` or `platform`.
  The layering exists so `shell` does not become everything's dependency;
  `leaves-stay-leaves` and `middle-below-top` fail.
- Copying a kit file into an app instead of importing it.
  `pnpm check:structure` compares basenames and rejects the copy.

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
