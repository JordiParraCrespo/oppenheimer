---
"@oppenheimer/api": patch
---

`admin/` and `organizations/` follow the module contract like every other
module: a port and a Better Auth gateway in `infrastructure/`, and one use-case
slice per route, in place of the root-level services and multi-route
controllers. The HTTP surface is unchanged — `openapi.json` is byte-identical,
so the generated client is too — and the structure check no longer carries
any ledgered violations.

- Accepting an invitation whose system role is missing answers the
  `ROLE_007` problem document, as creating an organization and adding a member
  already did, instead of a bare 500.
