---
"@oppenheimer/api": patch
"@oppenheimer/api-client": patch
---

`GET /v1/organizations/:orgId/members/me` answers for the organization in the
path, not the session's active one, and refuses a caller who is not a member
there (`ORG_003`). The client method is now `getMembership(orgId)` (the SDK's
`getMembership({ path: { orgId } })`), with `orgId` required.
