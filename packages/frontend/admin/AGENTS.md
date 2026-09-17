# @oppenheimer/frontend-admin — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first.

The control plane's domain (`admin-users`, `roles`) on top of
`@oppenheimer/frontend-core`. Platform-free logic only; the UI lives in
`apps/admin-web`, `apps/admin-mobile` or the platform kits. The layer model
and the full "add a module" cookbook are
[`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Where things go

- A new module `things` → `src/modules/things/` with `thing.entity.ts`,
  `things.errors.ts`, `things.repository.ts`, `things.service.ts`,
  `things.module.ts` and `index.ts`; then `export * from './things'` in
  `src/modules/index.ts`, the two symbols in `src/di/tokens.ts`, and
  `ThingsModule` plus a `get things()` getter in `src/di/admin-app.ts`.
  `apps/admin-web/src/features/things/` may exist only afterwards.
- A new query hook → `src/react/things.queries.ts`, keys derived from
  `thingsKeys.all`, hooks over `useAdminApp()`, mutations invalidating by
  prefix in `onSuccess`; exported by name from `src/react/index.ts`.
- A permission or role rule the API also enforces → `@oppenheimer/shared`, not a
  second copy here. The endpoint side is
  [`.agents/rules/rbac-roles.md`](../../../.agents/rules/rbac-roles.md).
- Something the consumer product also needs → promote it to
  `@oppenheimer/frontend-core`.

## Before pushing

```bash
pnpm --filter @oppenheimer/frontend-admin lint
pnpm --filter @oppenheimer/frontend-admin test
pnpm --filter @oppenheimer/frontend-admin arch
pnpm --filter @oppenheimer/frontend-admin build   # the apps import dist/
```

## Patterns agents get wrong

- Calling `useOppenheimerApp()` in an admin hook. It resolves kernel services only;
  an admin hook reads `useAdminApp().roles`.
- Importing `@oppenheimer/frontend-consumer` to invalidate a member list.
  `products-never-meet` fails: invalidate `MEMBER_LISTS_KEY` from
  `@oppenheimer/frontend-core/react`, as `useAssignUserRoles` does.
- Putting a component, a `react-dom` import or an `expo-*` import here; a
  product package is loaded by both platforms.
- Writing a table, dialog or pill here because both control-plane apps need
  it. Shared UI goes to `../web` or `../mobile`; only logic lives here.

See [`.agents/rules/frontend-architecture.md`](../../../.agents/rules/frontend-architecture.md).
