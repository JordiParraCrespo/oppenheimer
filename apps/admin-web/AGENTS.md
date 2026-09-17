# @oppenheimer/admin-web — Agent Instructions

> Read the root [`CLAUDE.md`](../../CLAUDE.md) first, then
> [`ARCHITECTURE.md`](./ARCHITECTURE.md). The platform control plane: users,
> roles, grants. Consumer features stay in `apps/web`.

## Stack

- Vite SPA + TanStack Router (file routes in `src/routes/`; `src/routeTree.gen.ts`
  is generated — never edit it) + TanStack Query persisted to `localStorage`
- Tailwind v4 + `@oppenheimer/design-system-web`; web glue from `@oppenheimer/frontend-web`;
  react-i18next; React Hook Form + `useZodResolver` over `@oppenheimer/shared/schemas/*`
- Config from the **root `.env`** via `import.meta.env` (`envDir` points at the
  repo root; a `.env` here is not read). Dev runs on port 3003

## Where code goes

- A screen → `src/features/<module>/screens/`, mounted by a route under 120 lines.
- A form → `src/features/<module>/forms/` (props in, `onSubmit` out; no fetching).
- A dialog → `src/features/<module>/dialogs/`, one per file, owns its mutation.
- A helper two screens use → `@oppenheimer/frontend-web`, not a second copy and not
  `src/lib/` (only `oppenheimer.ts`, `auth-client.ts`, `nav.ts` live there).
- Logic — entities, repositories, query hooks → `@oppenheimer/frontend-admin` or
  `@oppenheimer/frontend-core`. Never `@oppenheimer/frontend-consumer`.

## Before pushing

```bash
pnpm --filter @oppenheimer/admin-web lint && pnpm --filter @oppenheimer/admin-web test
pnpm --filter @oppenheimer/admin-web arch
pnpm check:structure
```

## Patterns agents get wrong

- Adding a registration path. `src/lib/auth-client.ts` throws from `signUp` and
  passes `requestSignUp: false`: accounts are provisioned by an administrator,
  and that refusal is the feature.
- Naming a feature after the page (`team`, `settings`). Only kernel modules and
  `admin-users` / `roles` are allowed; this app has no allowlist entry.
- Writing a role's permission list into a component. It belongs in
  `src/features/roles/lib/permission-areas.ts`, which carries no JSX.

Placement is [`.agents/rules/frontend-architecture.md`](../../.agents/rules/frontend-architecture.md);
what the markup looks like is [`.agents/rules/frontend-ui.md`](../../.agents/rules/frontend-ui.md).
