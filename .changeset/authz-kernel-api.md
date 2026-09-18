---
"@oppenheimer/api": minor
---

Adopt the authorization kernel, and close two defects in the existing system:
`PoliciesGuard` allowed any authenticated caller through a route that declared
no policy, and roles were global (`role.name` was unique table-wide), so two
tenants could not both define a `manager` role.
