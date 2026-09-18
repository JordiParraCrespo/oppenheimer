---
"@oppenheimer/api": minor
"@oppenheimer/translations": patch
---

Sign-up's side effects are domain use cases instead of SQL in a Better Auth
hook. The hook raises one `CompleteSignUpCommand`; handlers in the roles and
organizations modules grant the default `user` role and provision the personal
workspace — one organization, its owner membership and the org-scoped `owner`
grant, written in a single transaction and idempotent.

Two changes callers can see:

- A slug derived from a name with no URL-safe characters now falls back to
  `workspace-…` everywhere. The organizations endpoints previously answered
  `org-…`; there is one slug rule now, shared with the personal workspace.
- `ROLE_007` is new: a system role the deployment needs is not installed. It
  replaces a bare 500 with no code on the organization-create path and a
  swallowed failure on the sign-up path.
