---
"@oppenheimer/backend-authz": minor
"@oppenheimer/shared": minor
"@oppenheimer/api": minor
---

Add the authorization kernel: a feature module declares one resource object and
gets tenant isolation, team scoping, row-level SQL filtering, a role-builder
entry and a credential scope without writing an authorization check.

Also closes two defects in the existing system: `PoliciesGuard` allowed any
authenticated caller through a route that declared no policy, and roles were
global (`role.name` was unique table-wide), so two tenants could not both define
a `manager` role.
