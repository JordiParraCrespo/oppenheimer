---
"@oppenheimer/web": minor
"@oppenheimer/api": minor
"@oppenheimer/translations": patch
---

Carry the console's own code onto the starter's tightened contracts.

**The create-key dialog takes the per-row permission picker.** Upstream split
`PermissionPicker` because one flat `Scope[]` for eleven groups made a click
re-render thirty-three toggles, and put the picker behind a full-page screen
the console does not mount. The console keeps its dialog and takes the split:
`CreateApiTokenForm` holds a `ScopeSelection` keyed by resource, each row takes
its own field, and `PermissionField` carries the cross-row rule ("a key with no
scopes can call nothing") without subscribing the picker to the value its rows
write. The permission search that sat beside it — live state in the component
that mapped the groups, so a keystroke redrew every visible row — is now
`PermissionSearch`, which keeps the half-typed word and commits once per burst.
`permission-picker-render.spec.tsx` measures the dialog that ships: one click,
one row.

**The API's own slices satisfy the module contract.** `pnpm check:api-structure`
arrived with the starter and reported the three slices the console added:
sign-up's `CompleteSignUpCommandHandler`, the personal workspace's
`ProvisionPersonalWorkspaceCommandHandler` and the default grant's
`AssignDefaultRoleCommandHandler` were `*.service.ts` at the contract's
`*.command-handler.ts`. Two loose files moved to the layer they belong to:
`auth-command-bus.ts` is `auth/infrastructure/auth-command-bus.adapter.ts` — the
wiring Better Auth's module-scope hooks need — and `missing-system-role.ts` is
`roles/application/missing-system-role.factory.ts`, in `application/` because it
builds an `AppError` and the domain layer may not reach for
`@oppenheimer/backend-core`. It is published cross-module surface, because the
two other paths that raise it are in `organizations`, and the seed is exempt
from `no-cross-module-internals` for the reason it is already exempt from the
Better Auth rule: it is a composition root of its own, with no command bus.

**`ROLE_007` gets its message.** The new error-catalog fixture found that
`SYSTEM_ROLE_MISSING` had a catalog entry and a docs row but no
`errors.byCode` string in either locale, so a missing system role reached a
client as the generic fallback.
