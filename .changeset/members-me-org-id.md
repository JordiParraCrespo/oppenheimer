---
"@oppenheimer/api": patch
"@oppenheimer/api-client": patch
---

`GET /v1/organizations/:orgId/members/me` answers for the organization in the
path, not the session's active one. The SDK call is
`getMembership({ path: { orgId } })`, with `orgId` required.

Like every route that names its organization, it is authorized in that
organization: a caller who is not a member there holds no roles in it and is
refused by the policy check with `AUTH_002`. `ORG_003` is left for a caller
whose global roles pass that check (a platform admin) but who holds no
membership there. A path value that is not a UUID is `AUTHZ_003`.

The legacy `OrganizationMembersApi` class, which nothing called and nothing
regenerates, is removed; use the SDK.
