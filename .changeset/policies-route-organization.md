---
"@oppenheimer/api": patch
---

Every request acts in one organization, decided once when it is
authenticated and stamped on the request: on an `@OrganizationScoped` route
the organization the path names, otherwise the session's active organization
(or a checked `X-Active-Organization` header). The ability `PoliciesGuard`
checks, the `${activeOrganizationId}` condition placeholder and the access
scope (teams, roles and grants) are all resolved in that organization, so a
session with another organization selected, or an API token not pinned to
one, is judged by its roles where it acts. A route that names its organization
fails closed: a path value that is not a UUID is refused with `AUTHZ_003`
(400) before any lookup, and is never replaced by the session's organization.
