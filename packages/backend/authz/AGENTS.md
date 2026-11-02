# @oppenheimer/backend-authz — Agent Instructions

> Read the root [`CLAUDE.md`](../../../CLAUDE.md) first, then this package's
> `README.md`: the four questions and the two-step "add a resource" are the
> whole model.

## Where things go

- A new resource is one registration in `src/registry/` from the feature
  module that owns it; tenant isolation, scoping, the role-builder entry and
  the credential scope follow from it. There is no third step.
- Grants and their SQL filtering live in `src/grants/`, the CASL ability in
  `src/ability/`, the guards in `src/guards/`. Test doubles are in
  `src/testing/` — use them rather than mocking the guards.

## Before pushing

```bash
pnpm --filter @oppenheimer/backend-authz test
pnpm --filter @oppenheimer/backend-authz build
pnpm --filter @oppenheimer/api arch      # the API's boundaries still hold
```

## Patterns agents get wrong

- Writing an authorization check in a controller or a handler. Declare the
  resource; the kernel answers the four questions.
- Adding a permission that no grant can reach, or a role that names a
  permission the registry does not know. The catalog and the registry are
  asserted against each other in the API's tests.
- Short-circuiting on the platform role anywhere but Q0.

See [`.agents/rules/rbac-roles.md`](../../../.agents/rules/rbac-roles.md) and
[`.agents/rules/backend-packages.md`](../../../.agents/rules/backend-packages.md).
