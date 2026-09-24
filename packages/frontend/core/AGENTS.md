# @oppenheimer/frontend-core — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

The kernel every frontend app loads: the logic that is no one product's, the
InversifyJS container the product package extends, and the React bindings over it.
The layer model is [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Where things go

- A new kernel module `things` → `src/modules/things/` with
  `thing.entity.ts`, `things.errors.ts`, `things.repository.ts`,
  `things.service.ts`, `things.module.ts`, `index.ts`; then
  `export * from './things'` in `src/modules/index.ts`, the tokens in
  `src/di/tokens.ts`, the `ContainerModule` in `OppenheimerApp.create`
  (`src/di/oppenheimer-app.ts`) and a `get things()` getter beside `get auth()`.
  A module belongs here only when it is not product logic — every app would
  need it (session, users, settings); otherwise it goes to `../consumer`.
- A new query hook → `src/react/<module>.queries.ts` next to its key factory
  (every key derived from `all`), then exported by name from
  `src/react/index.ts`. `src/modules/` never imports `src/react/`.
- A key that is a kernel contract → `src/react/query-keys.ts`
  (`MEMBER_LISTS_KEY` lives there for exactly that reason), not a product
  package.
- A feature whose responses must never reach storage → add its key prefix to
  `KERNEL_NON_PERSISTED_FEATURES` in `src/react/persistence.ts`.
- A translated message for a Zod issue → `src/validation/zod-error-map.ts`
  plus every locale in `@oppenheimer/translations`; for an API error code,
  `errors.byCode.<CODE>` in every locale, resolved by
  `createErrorMessageResolver` in `src/modules/core/error-message.ts`.

## Before pushing

```bash
pnpm --filter @oppenheimer/frontend-core lint
pnpm --filter @oppenheimer/frontend-core test
pnpm --filter @oppenheimer/frontend-core arch
pnpm --filter @oppenheimer/frontend-core build   # the apps import dist/, so build after changing exports
```

## Patterns agents get wrong

- Importing a product package from here. The kernel never imports
  `@oppenheimer/frontend-consumer`; what a product builds on is an export of
  this package. `kernel-knows-no-product` fails otherwise.
- Reaching for `react-dom` or `@tanstack/react-router`, or importing a
  platform kit. The kernel holds no platform code; `domain-knows-no-platform`
  fails.
- Putting a component here. There is no UI in a domain package — it goes to
  `../web`, and the hook it needs stays here.
- Adding a module here because the product needs it now. It goes to the
  product package and is promoted only when it turns out not to be product
  logic.

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
