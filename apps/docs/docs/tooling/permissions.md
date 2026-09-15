---
sidebar_position: 1
---

# Granular permissions

Oppenheimer has two authorization layers, and understanding the split is the key to
everything else on this page.

| Layer            | Governs                                    | Lives in                 |
| ---------------- | ------------------------------------------ | ------------------------ |
| **Roles** (CASL) | What a _person_ may do                     | The `role` table         |
| **Scopes**       | What a _credential_ may do on their behalf | The token or OAuth grant |

A browser session carries no scopes: it can do whatever its owner's roles
allow. An API token or an MCP client's OAuth grant is additionally narrowed to
the scopes it was given, and the two are intersected on every request:

```
effective permissions = credential scopes ∩ owner's live CASL ability
```

Two consequences worth internalising:

- A token can never be minted with more reach than its creator has.
- Revoking someone's role immediately narrows every credential they issued —
  no need to hunt down tokens.

## The catalog

Permissions are grouped by resource, each with a **Read** and an **Edit**
level. Edit implies Read.

| Group               | Scopes                                 | Covers                                                   |
| ------------------- | -------------------------------------- | -------------------------------------------------------- |
| Profile             | `profile:read` `profile:write`         | The credential owner's own account                       |
| Users               | `users:read` `users:write`             | The user directory                                       |
| User administration | `admin:read` `admin:write`             | Bans, impersonation, password resets, session revocation |
| Roles & permissions | `roles:read` `roles:write`             | Role definitions and assignments                         |
| Organizations       | `organizations:read` `…:write`         | Organizations                                            |
| Members             | `members:read` `members:write`         | Organization membership and member roles                 |
| Invitations         | `invitations:read` `invitations:write` | Pending invitations                                      |
| Workspaces          | `workspaces:read` `workspaces:write`   | Workspaces (teams) and their members                     |
| API tokens          | `tokens:read` `tokens:write`           | The owner's own API tokens                               |

The catalog is defined once, in `packages/shared/src/scopes/catalog.ts`, and is
consumed by the API guard, the MCP server, the CLI and the web permission
picker. Adding a resource there makes it appear on every surface.

Privileged user administration is deliberately its own group: a token that
manages the user directory should not also be able to ban people or take over
their accounts.

## Resource scoping

On top of scopes, a token can be pinned to specific organizations. Leaving the
list empty lets it follow the owner's memberships instead, which is usually
what you want — the token keeps working as they join and leave organizations.

A token restricted to exactly one organization acts inside it by default, so
organization-bound routes resolve without an explicit id.

## Protecting an endpoint

Two decorators, and they answer different questions:

```ts
@Get()
@Version('1')
@CheckPolicies({ action: 'read', subject: 'User' })   // may this *person*?
@RequireScopes('users:read')                          // may this *credential*?
findAll() {}
```

`ScopesGuard` is registered globally and **fails closed**: a route that
declares no `@RequireScopes` cannot be called with a token at all. New
endpoints are therefore invisible to tokens until someone decides what they
should cost. Browser sessions are unaffected.

For organization-bound routes, name the parameter carrying the organization id
so the guard can enforce a token's restriction:

```ts
@Get(':orgId/members')
@RequireScopes('members:read')
@OrganizationScoped('orgId')
list() {}
```

## Credentials

### API tokens

Personal access tokens, minted from `/settings/api-tokens` or
`oppenheimer tokens create`. Format `oppenheimer_pat_…`; only a SHA-256 digest is stored, so
the secret is shown once and is not recoverable. Tokens support an expiry, an
IP allowlist and organization scoping, and are revoked (not deleted) so the
audit trail survives.

Present one as `Authorization: Bearer oppenheimer_pat_…` or in `x-api-key`.

:::note IP allowlists behind a proxy
The allowlist matches the address Express reports. Behind a load balancer that
is the proxy's address unless you configure `trust proxy`, so set that up
before relying on the restriction.
:::

### OAuth 2.1 (for MCP clients)

Better Auth's MCP plugin turns the API into an OAuth provider: discovery
metadata, dynamic client registration, authorization and token endpoints. A
client that hits the remote MCP server without a token gets a `401` carrying
`WWW-Authenticate: Bearer resource_metadata=…`, follows it, registers itself,
and sends the user to the consent screen at `/oauth/consent`.

The consent screen lists the requested permissions with the catalog's own
descriptions. Better Auth grants or refuses the request as a whole; someone who
wants to grant something narrower can create an API token instead.

## Asking what a credential can do

```
GET /api/v1/me/credential
```

Returns the credential kind, its `grantedScopes`, and the `effectiveScopes`
those amount to after the owner's roles are applied. The MCP server filters its
tool list by exactly this, and `oppenheimer whoami` prints it — including a warning
when a granted scope has gone inert because the owner's roles changed.

## Error codes

| Code        | Meaning                                                      |
| ----------- | ------------------------------------------------------------ |
| `TOKEN_002` | Requested scopes exceed what the creator holds               |
| `TOKEN_003` | Invalid, revoked or expired credential (deliberately opaque) |
| `TOKEN_004` | Used from an address outside the token's allowlist           |
| `TOKEN_005` | Missing a scope the endpoint requires                        |
| `TOKEN_006` | The endpoint is not reachable with a scoped credential       |
| `TOKEN_007` | Outside the credential's organization restriction            |
| `TOKEN_008` | Scoped to an organization the creator does not belong to     |
| `TOKEN_009` | Active token limit reached                                   |
