---
"@oppenheimer/api": minor
---

Pair a machine and let it authenticate as itself.

`hosts/` is the first of the control plane's own modules: `POST /hosts/pairing`
mints a registration token and the install command that spends it, `POST
/hosts/register` redeems one and creates the host in the same transaction, and
`GET`/`PATCH`/`DELETE /hosts` list, rename and unpair what a person paired. A
host belongs to that person and not to a workspace, so it carries no
`organizationId` and is scoped by `own` or an explicit grant.

The runner's boot assertion is an ordinary `Authorization: Bearer`, so the
credential resolver learns a fourth kind: an EdDSA JWS verified against the
host's registered key, with its `jti` burned for the token's remaining life. It
yields a principal with no scopes and no user, which reaches routes that require
none and nothing else.
