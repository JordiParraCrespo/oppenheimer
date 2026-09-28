---
"@oppenheimer/api": patch
---

- A membership whose application role cannot be written is undone rather than
  left on the roster: adding a member, changing a member's role and accepting
  an invitation now roll the Better Auth write back, as creating an
  organization already did. Accepting an invitation whose system role is
  missing answers `ROLE_007` instead of a bare 500.
- Removing a member or leaving takes their roles, access grants and session
  selection in one transaction.
- `GET /v1/organizations/{orgId}/members` filters in the database, and is no
  longer capped by Better Auth's page size.
- `POST /v1/organizations/check-slug` answers `available: false` only for a
  taken slug; any other refusal is the problem document it is.
- `POST /v1/admin/users/{id}/sessions/revoke` finds the session by id, and the
  admin session list reads every row rather than the first 1,000.
- An organization created from the console raises `OrganizationCreatedDomainEvent`
  rather than sign-up's `PersonalWorkspaceProvisionedDomainEvent`.
- Operation ids of admin, organization, invitation and workspace routes the
  console does not call now name their use case (`add` → `addMember`,
  `ban` → `banUser`, …).
