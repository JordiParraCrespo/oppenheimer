---
"@oppenheimer/api": patch
"@oppenheimer/translations": patch
"@oppenheimer/api-client": patch
---

Creating a role no longer falls back to a global role when the request has no
organization. `POST /v1/roles` without an active organization answers `ROLE_008`
(400) instead of writing a role every tenant reads. A global role is only created
by an internal caller that sets `CreateRoleCommand.global`, and then only for an
actor holding `manage all` on the platform. Adds the `ROLE_008` message in both
locales.
