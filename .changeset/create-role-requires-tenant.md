---
"@oppenheimer/api": patch
"@oppenheimer/translations": patch
"@oppenheimer/api-client": patch
---

Creating a role no longer falls back to a global role for any caller when the
request has no organization. `POST /v1/roles` without an active organization
still creates a global role for a platform admin (`manage all`), and answers
`ROLE_008` (400) for anyone else instead of writing a role every tenant reads.
The command must set `CreateRoleCommand.global` explicitly, and the handler
checks `manage all` again before creating the role. Adds the `ROLE_008`
message in both locales.
