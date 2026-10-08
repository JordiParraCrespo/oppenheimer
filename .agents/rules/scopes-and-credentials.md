---
paths:
  - "apps/api/**/*"
  - "packages/shared/**/*"
---

# Scopes & Credentials Rules

Authorization has **two layers**, and they answer different questions:

| Layer        | Question                       | Enforced by                        |
| ------------ | ------------------------------ | ---------------------------------- |
| Roles (CASL) | May this **person** do it?     | `PoliciesGuard` + `@CheckPolicies` |
| Scopes       | May this **credential** do it? | `ScopesGuard` + `@RequireScopes`   |

```
effective permissions = credential scopes ∩ owner's live CASL ability
```

A browser session carries no scopes and is governed by roles alone. An API
token or OAuth grant is additionally narrowed. Two properties fall out of this
and must not be broken:

- a token can never be minted with more reach than its creator has
  (`grantableScopes` in `@oppenheimer/shared`, enforced in `CreateApiTokenService`);
- revoking a role instantly narrows every credential that user issued, because
  the ability is rebuilt per request, never cached into the token.

## The catalog is the single source of truth

`packages/shared/src/scopes/catalog.ts` defines the permission groups, each
with a Read and an Edit level. **Add a resource there and nowhere else** — the
API guard and the web permission picker both read from it.

- `write` implies `read` on the same resource (`expandScopes`). Never grant both
  explicitly; grant `write`.
- Each level lists the CASL rules that back it. That list is what decides
  whether a user may grant the level.
- Privileged account operations (ban, impersonate, set-password, revoke
  sessions) belong to the `admin` group, **not** `users`. Keep them apart: a
  token that manages the directory must not be able to take over accounts.

## Protecting an endpoint

Every new route needs both decorators:

```ts
@Get()
@Version('1')
@CheckPolicies({ action: 'read', subject: 'User' })
@RequireScopes('users:read')
findAll() {}
```

`ScopesGuard` is global and **fails closed**: a route with no `@RequireScopes`
throws `TOKEN_006` for any scoped credential. Forgetting the decorator makes an
endpoint invisible to tokens — it never makes it accidentally reachable.

Organization-bound routes must also declare which parameter carries the
organization id, or a restricted token could reach another organization. The
same declaration names the request's tenant (`product/versions/mvp/08-auth.md`).
A route that takes the organization in the query or body says so:
`@OrganizationScoped('organizationId', 'query')`.

```ts
@Get(':orgId/members')
@RequireScopes('members:read')
@OrganizationScoped('orgId')
list() {}
```

Use `@AllowAnyScope()` only for routes that expose nothing but the caller's own
identity, its own work, or data already served to anonymous callers. Each one
carries its reason in `ANY_SCOPE` in
`apps/api/src/__tests__/route-scope-coverage.spec.ts`, which is the current list.

Every route's scope requirement is written down in
`apps/api/src/__tests__/route-scopes.inventory.json` and checked against the
source both ways: a new route, or a changed `@RequireScopes`, is an inventory
change in the same diff. A `GET` may not require a write scope.

## Credential handling

- Token secrets are **only** ever stored as a SHA-256 digest. Never log a
  secret, never put one in a cache key (`credentialId` for OAuth is a digest
  prefix for exactly this reason), never add an endpoint that returns one after
  creation. The same goes for session tokens: Better Auth's session cache is
  keyed `ba:<sha256>` (`better-auth-secondary-storage.adapter.ts`), and the
  rate limiter buckets a presented credential by `cred:<digest>`.
- Each credential is resolved **once per request**, through
  `CREDENTIAL_SCOPE` (`resolve`, `resolveSession`), whoever asks; nothing
  else calls `auth.api.getSession`. The owner lookup is
  `CREDENTIAL_OWNER.requireActiveOwner`, never a private copy.
- Authentication failures share one opaque error (`TOKEN_003`) whether the
  token is unknown, revoked or expired, or its owner is deactivated or banned —
  distinguishing them hands out a probing oracle. Authorization failures are
  specific, because the caller already proved who they are and needs to know
  what they are short of.
- Whether an account may act at all is one rule, `isAccessAllowed`
  (`auth/domain/account-access.policy.ts`): deactivated never, banned until
  the ban's expiry. The credential owner lookup and the session path in
  `ApiAuthGuard` both ask it; do not write the check again anywhere else.
- Someone else's token is reported as **not found**, not forbidden, so ids
  cannot be probed.
- Revocation raises `ApiTokenRevokedDomainEvent`; a handler in the api-tokens
  module listens and drops the cached delegated session through the kernel's
  `DELEGATED_SESSION` port, so it takes effect immediately. Do not call the
  auth layer from the revoke use case — that is what the event is for, and the
  kernel cannot listen for it itself: it does not know this module exists.

## Adding a credential kind

`apps/api/src/auth` is a kernel and may import nothing else under `src/`
(`auth-is-a-kernel` in `apps/api/.dependency-cruiser.cjs`). It resolves the two
credentials it issues — a Better Auth session and an OAuth grant — and takes
every other kind from the module that owns it:

1. write `<module>/application/<kind>-credential.resolver.ts` implementing
   `CredentialResolverPort` (a unique `kind`, a cheap `recognises` on the
   presented string, a `resolve` that verifies it and throws on refusal);
2. spread `AuthModule.contributeCredentials([<Kind>CredentialResolver])` into
   that module's **`providers`**. The resolver is then built in your module's
   own injector, so it injects your repository ports directly — nothing has to
   be made `@Global` to reach it — plus the kernel's `CREDENTIAL_OWNER` port
   for the account behind the credential.

Refusals a guard raises about any credential (`TOKEN_003`, `TOKEN_005`–`007`)
belong to `auth/domain/auth.errors.ts`; what your kind specifically can fail on
is your module's catalog.

## Delegated sessions

Façade modules (organizations, members, invitations, workspaces, admin, and
the profile routes that change a password, an email or sessions) call
`auth.api.*`, which resolves the caller from a Better Auth session. Scoped
credentials have none, so on a route marked **`@UsesBetterAuthSession()`**
`ApiAuthGuard` mints a short-lived session for the owner and rewrites
`Authorization` to it (accepted thanks to the `bearer` plugin). It is cached
per credential for ten minutes, and a lookup is one Redis round trip. Every
other route skips it: most of the API never calls Better Auth.

**A new façade that calls `auth.api.*` with the incoming headers must carry
`@UsesBetterAuthSession()`** on its controller (or handler), or it answers a
scoped credential as if nobody were signed in.
`auth/__tests__/delegated-session-coverage.spec.ts` lists every file that calls
`auth.api.*` and the controllers that reach it, and fails on a new one until it
is listed and marked. If you bypass the guard, none of this works.
