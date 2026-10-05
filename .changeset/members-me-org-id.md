---
"@oppenheimer/api": patch
"@oppenheimer/api-client": patch
---

`GET /v1/organizations/:orgId/members/me` answers for the organization in the path (`getMembership({ path: { orgId } })`); the unused legacy `OrganizationMembersApi` class is removed.
