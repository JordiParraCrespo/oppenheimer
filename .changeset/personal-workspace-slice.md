---
"@oppenheimer/api": minor
"@oppenheimer/translations": patch
---

Make what sign-up owes a new account a pair of domain use cases instead of SQL
in a Better Auth hook.

The MVP's central identity rule — every account gets a personal workspace: one
organization it owns, plus the org-scoped `owner` role that opens it — lived in
`auth/personal-workspace.ts` as raw `INSERT` statements run from
`databaseHooks.user.create.after`, alongside a second statement granting the
default `user` role. It worked, and nothing about it was expressible in the
domain: no aggregate, no repository port, no handler, no event, and the slug
rule written a second time so a workspace sign-up provisioned and one a person
created could disagree about what a slug is.

Now:

- `PersonalWorkspaceEntity` is an aggregate over the three rows that are one
  fact — the organization, the owner membership, and the role grant without
  which the owner is refused from their own workspace. Its repository writes
  them in one transaction and stages
  `PersonalWorkspaceProvisionedDomainEvent` on the outbox alongside them.
- `ProvisionPersonalWorkspaceCommand` and `AssignDefaultRoleCommand` are
  ordinary CQRS handlers in the `organizations` and `roles` modules, with unit
  tests. Both are idempotent, so sign-up and the seed can provision the same
  account.
- `OrganizationSlug` is a value object, so there is one slug rule. Its fallback
  for a name with nothing slug-safe in it is now `workspace-…` everywhere; the
  organizations façade used to answer `org-…`.
- `auth/auth-command-bus.ts` is the one seam between Better Auth — configured
  at module scope, so its hooks can inject nothing — and the application's use
  cases. Hooks dispatch commands; failures are logged rather than swallowed.

Adds `ORG_017`, raised when the system `owner` role is missing, so a database
behind the code reports itself instead of writing an organization nobody can
open.

No behaviour change to any endpoint: sign-up, sign-in and password reset return
exactly what they did, and the sign-up hook stays best-effort.
