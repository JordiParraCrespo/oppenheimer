---
"@oppenheimer/api": patch
---

Organization membership changes undo cleanly, and a few edges are closed.

- A role change is `MembershipAccessPolicy.reassign`: the new application role
  first, Better Auth's write second, and on a refusal the application roles
  held before are put back in the app's own store. The undo no longer needs
  the caller's permission, which an owner demoting themselves has just given
  up. A member that is not in the organization is `ORG_005`.
- Undoing an accepted invitation reopens it first and leaves second
  (`InvitationRepositoryPort.reopen` / `markAccepted`), so a retry finds a
  pending invitation, and no failure leaves an accepted invitation with no
  membership.
- The slug check reads Better Auth's `ORGANIZATION_SLUG_ALREADY_TAKEN` off the
  error itself; other codes that share the `ORG_002` entry are no longer read
  as "taken".
- Creating an organization always takes its owner from the authenticated
  caller and always grants the owner role.
- Revoking a membership never selects the organization being left as the
  session's fallback.
