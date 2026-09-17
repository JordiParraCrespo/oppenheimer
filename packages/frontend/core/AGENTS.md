# @oppenheimer/frontend-core — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

The kernel every frontend app loads: the logic both products share, the
InversifyJS container the products extend, and the React bindings over it.
The layer model is [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Where things go

- A new kernel module `things` → `src/modules/things/` with
  `thing.entity.ts`, `things.errors.ts`, `things.repository.ts`,
  `things.service.ts`, `things.module.ts`, `index.ts`; then
  `export * from './things'` in `src/modules/index.ts`, the tokens in
  `src/di/tokens.ts`, the `ContainerModule` in `OppenheimerApp.create`
  (`src/di/oppenheimer-app.ts`) and a `get things()` getter beside `get auth()`.
  A module belongs here only when **both** products need it; otherwise it
  goes to `../consumer` or `../admin`.
- A new query hook → `src/react/<module>.queries.ts` next to its key factory
  (every key derived from `all`), then exported by name from
  `src/react/index.ts`. `src/modules/` never imports `src/react/`.
- A key two products share → `src/react/query-keys.ts` (`MEMBER_LISTS_KEY`
  lives there for exactly that reason), not a product package.
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

- Importing a product package from here. The kernel imports neither
  `@oppenheimer/frontend-consumer` nor `@oppenheimer/frontend-admin`; what they share is
  an export of this package. `kernel-knows-no-product` fails otherwise.
- Reaching for `react-dom`, `react-native`, `expo-*` or
  `@tanstack/react-router`, or importing a platform kit. The kernel runs on
  both platforms; `domain-knows-no-platform` fails.
- Putting a component here. There is no UI in a domain package — it goes to
  `../web` or `../mobile`, and the hook it needs stays here.
- Adding a module here because one product needs it now. It goes to that
  product and is promoted when the second product asks for it.

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
