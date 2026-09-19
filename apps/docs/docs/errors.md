---
sidebar_position: 6
title: Error reference
---

# Error reference

Every non-2xx response from the Oppenheimer API is an **RFC 7807 problem document**
([Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807))
served as `application/problem+json`:

```json
{
  "type": "https://oppenheimer.dev/errors#user_001",
  "title": "User not found",
  "status": 404,
  "detail": "No user with id 3f1c0f7e-…",
  "instance": "/api/v1/users/3f1c0f7e-…",
  "code": "USER_001",
  "correlationId": "2b4f…",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Members

| Member          | Standard? | Meaning                                                                                                                             |
| --------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type`          | RFC 7807  | URI identifying the problem **type** — the anchor on this page. `about:blank` when the status code says everything there is to say. |
| `title`         | RFC 7807  | Short summary of the problem type. **Stable** across occurrences — safe to switch on, though `code` is better.                      |
| `status`        | RFC 7807  | The HTTP status code, repeated in the body.                                                                                         |
| `detail`        | RFC 7807  | What went wrong on **this** request: ids, which scope was missing, which field was rejected. Never assume it is stable.             |
| `instance`      | RFC 7807  | The request path this occurred on.                                                                                                  |
| `code`          | extension | Machine-readable catalog code (`USER_001`). This is what clients should branch on.                                                  |
| `correlationId` | extension | Quote it in a bug report — it ties the response to the server-side log entry.                                                       |
| `timestamp`     | extension | When the problem was produced (ISO 8601).                                                                                           |
| `invalidParams` | extension | Per-field validation failures: `[{ "name": "email", "reason": "Invalid email" }]`.                                                  |

Individual errors may add further extension members (for example
`missingScopes` on `TOKEN_005`). Unknown members should be ignored, not treated
as an error.

An unexpected `5xx` never carries an internal message — the status is preserved
(a readiness failure still answers `503`) but the `detail` always reads
`"An unexpected error occurred. Quote the correlation id when reporting it."`
The specifics are in the server log, keyed by `correlationId`. Catalog errors
that are themselves `5xx` (e.g. `BILLING_001`) keep their curated title, since
that text was written to be shown.

The `type` base is configurable with `ERROR_TYPE_BASE_URL` so a deployment can
point at its own documentation.

## Validation failures {#validation_failed}

**`VALIDATION_FAILED` — 400.** The request body or query string did not match
the endpoint's Zod schema. Every rejected field is listed in `invalidParams`:

```json
{
  "type": "https://oppenheimer.dev/errors#validation_failed",
  "title": "Validation failed",
  "status": 400,
  "detail": "The request body or query string did not match the expected schema.",
  "code": "VALIDATION_FAILED",
  "invalidParams": [
    { "name": "email", "reason": "Invalid email" },
    { "name": "scopes.0", "reason": "Invalid scope" }
  ]
}
```

## Authentication & authorization

Raised by the guards on every protected route, before a handler runs.

| Code                           | Title                                                | HTTP |
| ------------------------------ | ---------------------------------------------------- | ---- |
| `AUTH_001` <a id="auth_001" /> | Authentication required                              | 401  |
| `AUTH_002` <a id="auth_002" /> | You do not have permission to perform this action    | 403  |

These are deliberately coarse. Naming the rule that failed, or distinguishing
an absent session from an expired one, would turn the endpoint into a probing
oracle for the permission model — the specifics stay in the server log. Where
the caller already proved who they are and needs to know what their credential
is short of, the more precise `TOKEN_*` codes are used instead.

## Users

| Code                           | Title          | HTTP |
| ------------------------------ | -------------- | ---- |
| `USER_001` <a id="user_001" /> | User not found | 404  |

## Profile

The caller's own account: profile fields, avatar, password and sessions.

| Code                                 | Title                                                 | HTTP |
| ------------------------------------ | ----------------------------------------------------- | ---- |
| `PROFILE_001` <a id="profile_001" /> | Profile not found                                     | 404  |
| `PROFILE_002` <a id="profile_002" /> | The current password is incorrect                     | 400  |
| `PROFILE_003` <a id="profile_003" /> | Session not found                                     | 404  |
| `PROFILE_004` <a id="profile_004" /> | That file type is not supported for an avatar         | 415  |
| `PROFILE_005` <a id="profile_005" /> | That image is too large                               | 413  |
| `PROFILE_006` <a id="profile_006" /> | The new password does not meet the password policy    | 400  |
| `PROFILE_007` <a id="profile_007" /> | The session you are currently using cannot be revoked | 409  |
| `PROFILE_008` <a id="profile_008" /> | The account service could not complete that request   | 502  |

`PROFILE_003` is returned for a session belonging to someone else as well as one
that does not exist, so session ids cannot be probed.

## API tokens

| Code                             | Title                                                              | HTTP |
| -------------------------------- | ------------------------------------------------------------------ | ---- |
| `TOKEN_001` <a id="token_001" /> | API token not found                                                | 404  |
| `TOKEN_002` <a id="token_002" /> | A token cannot be granted permissions its creator does not hold    | 403  |
| `TOKEN_003` <a id="token_003" /> | Invalid or expired API token                                       | 401  |
| `TOKEN_004` <a id="token_004" /> | This API token may not be used from this IP address                | 403  |
| `TOKEN_005` <a id="token_005" /> | This credential is missing a permission required by this endpoint  | 403  |
| `TOKEN_006` <a id="token_006" /> | This endpoint cannot be called with a scoped credential            | 403  |
| `TOKEN_007` <a id="token_007" /> | This credential is not scoped to that organization                 | 403  |
| `TOKEN_008` <a id="token_008" /> | A token can only be scoped to organizations its creator belongs to | 403  |
| `TOKEN_009` <a id="token_009" /> | The maximum number of active API tokens has been reached           | 409  |

`TOKEN_003` is deliberately opaque: unknown, revoked and expired tokens share
one code so the endpoint cannot be used as a probing oracle.

The codes are grouped here by what a client sees, which is not always the
module that declares them. `TOKEN_003` and `TOKEN_005`–`TOKEN_007` are raised
by the auth kernel — the credential resolver and the scopes guard — about any
scoped credential, not only an API token, so they are declared in its catalog
and apply unchanged to every credential kind a module contributes.

`TOKEN_002` and `TOKEN_005` carry the offending scopes as extension members
(`ungrantableScopes` and `missingScopes`) as well as in `detail`.

## Roles

| Code                           | Title                                                                       | HTTP |
| ------------------------------ | --------------------------------------------------------------------------- | ---- |
| `ROLE_001` <a id="role_001" /> | Role not found                                                              | 404  |
| `ROLE_002` <a id="role_002" /> | A role with this name already exists                                        | 409  |
| `ROLE_003` <a id="role_003" /> | System roles cannot be deleted or renamed                                   | 403  |
| `ROLE_004` <a id="role_004" /> | A system role that grants full access ("manage all") cannot have it removed | 403  |
| `ROLE_005` <a id="role_005" /> | A role cannot be granted permissions its author does not hold               | 403  |
| `ROLE_006` <a id="role_006" /> | A role belonging to another organization cannot be modified                 | 403  |
| `ROLE_007` <a id="role_007" /> | A system role this deployment needs is not installed                        | 500  |

## Authorization

| Code                             | Title                                                  | HTTP |
| -------------------------------- | ------------------------------------------------------ | ---- |
| `AUTHZ_001` <a id="authz_001" /> | The active organization is not one of your memberships | 403  |
| `AUTHZ_002` <a id="authz_002" /> | This route declares no authorization policy            | 500  |

`AUTHZ_002` is a 500 rather than a 403 on purpose. A route that reached
production without declaring what it requires is a programming error, and
reporting it as a permission problem would send whoever hits it looking in the
wrong place. It is raised by the policies guard and declared in the auth
kernel's catalog, beside the other refusals a guard can produce.

## Access grants

| Code                             | Title                                                     | HTTP |
| -------------------------------- | --------------------------------------------------------- | ---- |
| `GRANT_001` <a id="grant_001" /> | Access grant not found                                    | 404  |
| `GRANT_002` <a id="grant_002" /> | An access grant cannot exceed the granter's own access    | 403  |
| `GRANT_003` <a id="grant_003" /> | The named principal does not belong to this organization  | 400  |
| `GRANT_004` <a id="grant_004" /> | Access grants are written inside an organization          | 400  |

## Leads

| Code                           | Title          | HTTP |
| ------------------------------ | -------------- | ---- |
| `LEAD_001` <a id="lead_001" /> | Lead not found                          | 404  |
| `LEAD_002` <a id="lead_002" /> | Leads are created inside an organization | 400  |

Also returned for a lead that exists but sits outside the caller's access
scope. Distinguishing the two would confirm the id.

## Billing

| Code                                 | Title                                        | HTTP |
| ------------------------------------ | -------------------------------------------- | ---- |
| `BILLING_001` <a id="billing_001" /> | Billing is not configured on this server     | 503  |
| `BILLING_002` <a id="billing_002" /> | No billing customer exists for this user     | 404  |
| `BILLING_003` <a id="billing_003" /> | No subscription found                        | 404  |
| `BILLING_004` <a id="billing_004" /> | Invalid Stripe webhook signature             | 400  |
| `BILLING_005` <a id="billing_005" /> | Failed to create a Stripe Checkout session   | 502  |
| `BILLING_006` <a id="billing_006" /> | This user already has an active subscription | 409  |
| `BILLING_007` <a id="billing_007" /> | Failed to open the Stripe Customer Portal    | 502  |
| `BILLING_008` <a id="billing_008" /> | Failed to create a Stripe customer           | 502  |

## Organizations, teams & invitations

The organization tables are owned by Better Auth, whose plugin raises its own
`SCREAMING_SNAKE_CASE` codes. Those are an upstream detail — there are ~60, they
are grouped by the wording of an English sentence rather than by what a client
would do about them, and they change between releases. The API folds them onto
the catalog below and preserves the original as an **`upstreamCode`** extension
member, so debugging keeps everything Better Auth said:

```json
{
  "type": "https://oppenheimer.dev/errors#org_002",
  "title": "That organization slug is already taken",
  "status": 409,
  "detail": "Organization slug already taken",
  "code": "ORG_002",
  "upstreamCode": "ORGANIZATION_SLUG_ALREADY_TAKEN"
}
```

Branch on `code`. `upstreamCode` is diagnostic only — it is not part of the
API's compatibility promise.

| Code                           | Title                                                     | HTTP |
| ------------------------------ | --------------------------------------------------------- | ---- |
| `ORG_001` <a id="org_001" /> | Organization not found                                    | 404  |
| `ORG_002` <a id="org_002" /> | That organization slug is already taken                   | 409  |
| `ORG_003` <a id="org_003" /> | You are not a member of this organization                 | 403  |
| `ORG_004` <a id="org_004" /> | Your role in this organization does not allow that        | 403  |
| `ORG_005` <a id="org_005" /> | Member not found in this organization                     | 404  |
| `ORG_006` <a id="org_006" /> | That user is already a member of this organization        | 409  |
| `ORG_007` <a id="org_007" /> | An organization cannot be left without an owner           | 409  |
| `ORG_008` <a id="org_008" /> | Invitation not found                                      | 404  |
| `ORG_009` <a id="org_009" /> | This invitation was issued to a different account         | 403  |
| `ORG_010` <a id="org_010" /> | That user has already been invited to this organization   | 409  |
| `ORG_011` <a id="org_011" /> | Verify your email address before acting on invitations    | 403  |
| `ORG_012` <a id="org_012" /> | Team not found                                            | 404  |
| `ORG_013` <a id="org_013" /> | A team with that name already exists                      | 409  |
| `ORG_014` <a id="org_014" /> | A limit on this organization has been reached             | 409  |
| `ORG_015` <a id="org_015" /> | The organization service rejected this request            | 400  |
| `ORG_016` <a id="org_016" /> | The organization service failed to handle this request    | 502  |

`ORG_015` and `ORG_016` are the fallbacks for an upstream code this version does
not recognise — a client should treat them as "retry or report", and the
`upstreamCode` says what actually happened.

## Admin

Same arrangement as organizations: Better Auth's admin plugin owns the
operation, its code is folded onto the catalog, and the original survives as
`upstreamCode`.

| Code                               | Title                                                             | HTTP |
| ---------------------------------- | ----------------------------------------------------------------- | ---- |
| `ADMIN_001` <a id="admin_001" /> | User not found                                                    | 404  |
| `ADMIN_002` <a id="admin_002" /> | A user with that email already exists                             | 409  |
| `ADMIN_003` <a id="admin_003" /> | Your account is not allowed to perform this administrative action | 403  |
| `ADMIN_004` <a id="admin_004" /> | An administrator cannot perform this action on their own account  | 403  |
| `ADMIN_005` <a id="admin_005" /> | That role does not exist or cannot be assigned                    | 400  |
| `ADMIN_006` <a id="admin_006" /> | That user is banned from this application                         | 403  |
| `ADMIN_007` <a id="admin_007" /> | The admin service rejected this request                           | 400  |
| `ADMIN_008` <a id="admin_008" /> | The admin service failed to handle this request                   | 502  |
| `ADMIN_009` <a id="admin_009" /> | No such session for that user                                     | 404  |

<!-- oppenheimer:begin runner -->
## Runner service

The Go runner (`apps/runner`) emits the same document shape with its own
catalog. `RUNNER_*` codes are the generic layer shared by every route; the
others belong to one bounded context each — `APIKEY_*` to credentials,
`HOST_*` to the host inventory, `PAIR_*` to pairing, `SVC_*` to the service
unit, `UPD_*` to self-update, and `SESS_*`, `TMUX_*` and `GIT_*` to sessions. The host-agent codes also reach a person
through the CLI, where they set the exit code: 3 for a 401, 4 for a 403, 5
for a 404 or 428, 6 for a 502, 503 or 504, and 1 for anything else.

| Code                                   | Title                                        | HTTP |
| -------------------------------------- | -------------------------------------------- | ---- |
| `RUNNER_001` <a id="runner_001" />     | Validation failed                            | 400  |
| `RUNNER_002` <a id="runner_002" />     | Authentication required                      | 401  |
| `RUNNER_003` <a id="runner_003" />     | Insufficient scope                           | 403  |
| `RUNNER_004` <a id="runner_004" />     | Resource not found                           | 404  |
| `RUNNER_005` <a id="runner_005" />     | Conflict                                     | 409  |
| `RUNNER_006` <a id="runner_006" />     | Payload too large                            | 413  |
| `RUNNER_500` <a id="runner_500" />     | Internal server error                        | 500  |
| `APIKEY_001` <a id="apikey_001" />     | API key not found                            | 404  |
| `APIKEY_002` <a id="apikey_002" />     | API key already revoked                      | 409  |
| `APIKEY_003` <a id="apikey_003" />     | Cannot grant scopes you do not hold          | 403  |
| `APIKEY_004` <a id="apikey_004" />     | Service tokens are not enabled               | 501  |
| `HOST_001` <a id="host_001" />         | Host platform is not supported               | 400  |
| `HOST_002` <a id="host_002" />         | The runner must not run as root              | 400  |
| `HOST_003` <a id="host_003" />         | A tool the runner needs is missing           | 424  |
| `HOST_004` <a id="host_004" />         | Free disk is below the floor                 | 507  |
| `HOST_005` <a id="host_005" />         | Could not inspect the host                   | 500  |
| `PAIR_001` <a id="pair_001" />         | This host is not paired yet                  | 428  |
| `PAIR_002` <a id="pair_002" />         | This host is already paired                  | 409  |
| `PAIR_003` <a id="pair_003" />         | The registration token was rejected          | 401  |
| `PAIR_004` <a id="pair_004" />         | The host key could not be read or written    | 500  |
| `PAIR_005` <a id="pair_005" />         | The control plane URL is not usable          | 400  |
| `PAIR_006` <a id="pair_006" />         | The control plane could not be reached       | 502  |
| `SVC_001` <a id="svc_001" />           | No service manager for this platform         | 400  |
| `SVC_002` <a id="svc_002" />           | The runner service could not be installed    | 500  |
| `SVC_003` <a id="svc_003" />           | The runner service is not installed          | 404  |
| `SVC_004` <a id="svc_004" />           | The service manager refused the command      | 500  |
| `SVC_005` <a id="svc_005" />           | The user service will not survive logout     | 424  |
| `UPD_001` <a id="upd_001" />           | The release manifest could not be verified   | 502  |
| `UPD_002` <a id="upd_002" />           | The release artifact could not be verified   | 502  |
| `UPD_003` <a id="upd_003" />           | No release exists for this platform          | 404  |
| `UPD_004` <a id="upd_004" />           | This host will not take that update          | 409  |
| `UPD_005` <a id="upd_005" />           | The new binary failed its self-check         | 500  |
| `UPD_006` <a id="upd_006" />           | The new version could not be activated       | 500  |
| `UPD_007` <a id="upd_007" />           | The update was rolled back                   | 500  |
| `UPD_008` <a id="upd_008" />           | This build has no release key and cannot self-update | 424 |
| `SESS_001` <a id="sess_001" />         | Session not found                            | 404  |
| `SESS_002` <a id="sess_002" />         | The session cannot be created with those values | 400 |
| `SESS_003` <a id="sess_003" />         | The session is not running                   | 409  |
| `SESS_004` <a id="sess_004" />         | A session already exists for that worktree   | 409  |
| `TMUX_001` <a id="tmux_001" />         | tmux is not available on this host           | 424  |
| `TMUX_002` <a id="tmux_002" />         | The tmux server refused the command          | 500  |
| `GIT_001` <a id="git_001" />           | The worktree could not be prepared           | 500  |
| `GIT_002` <a id="git_002" />           | A git command failed                         | 500  |
| `GIT_003` <a id="git_003" />           | The branch could not be pushed               | 409  |

<!-- oppenheimer:end runner -->
## Domain invariants

Exceptions raised by the DDD building blocks in `@oppenheimer/backend-ddd` surface
with their own codes rather than as a blanket 500:

| Code                                                                     | HTTP |
| ------------------------------------------------------------------------ | ---- |
| `GENERIC.ARGUMENT_INVALID` <a id="generic_argument_invalid" />           | 400  |
| `GENERIC.ARGUMENT_NOT_PROVIDED` <a id="generic_argument_not_provided" /> | 400  |
| `GENERIC.ARGUMENT_OUT_OF_RANGE` <a id="generic_argument_out_of_range" /> | 400  |
| `GENERIC.CONFLICT` <a id="generic_conflict" />                           | 409  |
| `GENERIC.NOT_FOUND` <a id="generic_not_found" />                         | 404  |

## Handling errors as a client

**CLI.** Failures map onto exit codes (`3` auth, `4` forbidden, `5` not found,
`1` everything else) and print `CODE: detail`, listing any rejected fields.

**MCP.** Tools throw `OppenheimerApiError`, which carries `status`, `code`,
`correlationId` and the whole `problem` document.

**Web / mobile.** `@oppenheimer/frontend` normalises failures into `AppError` via
`toAppError`, which keeps the server's `detail`, exposes `fieldErrors` for form
handling, and falls back to the module's own error catalog when the API could
not be reached at all.

## Adding an error

1. Add an entry to the module's catalog in
   `apps/api/src/<module>/domain/<module>.errors.ts`.
2. Throw it with `AppError`:

   ```ts
   throw new AppError(UserErrors.NOT_FOUND, {
     detail: `No user with id ${id}`,
     extensions: { userId: id },
   });
   ```

3. Document it on the endpoint with
   `@ApiProblemResponse({ status, description, code })` so it reaches the
   OpenAPI document and the generated client.
4. Add a row to this page — the problem `type` URI is an anchor here, so an
   undocumented code points at a dead link.
5. Add a message for the code under `errors.byCode` in **every** locale in
   `packages/translations`, so the web and mobile apps can show it in the
   user's language. A code with no entry falls back to a generic sentence.

The catalog `message` becomes the problem `title`, so keep it stable and put
anything specific to the request in `detail`.

### Only `AppError` carries a code

`AllExceptionsFilter` reads a `code` from **`AppError` alone**. A bare
`HttpException` — including `new HttpException({ message, code }, status)` —
produces a problem document with no `code` and `type: about:blank`, whose
`title` is just the status phrase ("Conflict"). This is deliberate: only
curated catalog codes are part of the public contract, so the filter will not
lift one off an arbitrary exception body.

The practical consequence is that **`throw new ForbiddenException(...)` or
`new NotFoundException(...)` in a handler silently drops out of the catalog**.
Use `AppError` with a catalog entry instead. Domain invariants raised by
`@oppenheimer/backend-ddd` (`ArgumentInvalidException` and friends) are the
exception — they carry their own `code` and `httpStatus`, and are listed above.

### Wrapping a third-party service

When a module delegates to something that raises its own errors — as the
organization and admin façades do with Better Auth — do not pass the upstream
error through. Fold its code onto a catalog entry with a mapper and keep the
original as an `upstreamCode` extension member:

```ts
export const invokeOrganizationApi = betterAuthInvoker(mapOrganizationError);
```

A mapper must be **total**: match the codes worth branching on, then fall back
on the HTTP status, so a code added by a future release of the dependency still
produces a documented problem instead of an unhandled 500.
