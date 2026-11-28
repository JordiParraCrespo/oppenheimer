---
'@oppenheimer/api': patch
---

Better Auth's own organization writes (`/api/auth/organization/*`: the roster, invitations, teams, and organization create, update and delete) now answer 404 to clients; the `/v1` façade is the one door. Accepting an invitation needs a verified email, and accepting one again grants the member's current role instead of the invitation's. A member removed from an organization, or leaving it, has their API tokens pinned to it revoked, and such a token is refused as soon as its owner is no longer a member. The `admin` platform role no longer holds `set-role` (nor a `role` on create or update user); that is `superadmin`'s alone.
