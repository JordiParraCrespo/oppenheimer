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
that are themselves `5xx` (e.g. `HOSTS_004`) keep their curated title, since
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

| Code                           | Title                                              | HTTP |
| ------------------------------ | -------------------------------------------------- | ---- |
| `USER_001` <a id="user_001" /> | User not found                                     | 404  |
| `USER_002` <a id="user_002" /> | That username is already taken                     | 409  |
| `USER_003` <a id="user_003" /> | The confirmation does not match your email address | 400  |

## Profile

The caller's own account: profile fields, avatar, email, password and
sessions. Deleting it is `USER_*`.

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
| `PROFILE_009` <a id="profile_009" /> | That is already your email address                    | 400  |

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

`TOKEN_003` is deliberately opaque: unknown, revoked and expired tokens, and
tokens whose owner is deactivated or banned, share one code so the endpoint
cannot be used as a probing oracle.

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
| `ROLE_008` <a id="role_008" /> | A role is created inside an organization                                    | 400  |

## Authorization

| Code                             | Title                                                          | HTTP |
| -------------------------------- | -------------------------------------------------------------- | ---- |
| `AUTHZ_002` <a id="authz_002" /> | This route declares no authorization policy                    | 500  |
| `AUTHZ_003` <a id="authz_003" /> | The organization this request names is not a valid id          | 400  |
| `AUTHZ_004` <a id="authz_004" /> | This route names an organization parameter it does not declare | 500  |

`AUTHZ_002` is a 500 rather than a 403 on purpose. A route that reached
production without declaring what it requires is a programming error, and
reporting it as a permission problem would send whoever hits it looking in the
wrong place. `AUTHZ_004` is the same kind of fault: `@OrganizationScoped`
names a path parameter the route does not have. Which organization a request
is authorized in is `product/versions/mvp/08-auth.md`.

## Access grants

| Code                             | Title                                                     | HTTP |
| -------------------------------- | --------------------------------------------------------- | ---- |
| `GRANT_001` <a id="grant_001" /> | Access grant not found                                    | 404  |
| `GRANT_002` <a id="grant_002" /> | An access grant cannot exceed the granter's own access    | 403  |
| `GRANT_003` <a id="grant_003" /> | The named principal does not belong to this organization  | 400  |
| `GRANT_004` <a id="grant_004" /> | Access grants are written inside an organization          | 400  |

## Rate limiting

| Code                           | Title             | HTTP |
| ------------------------------ | ----------------- | ---- |
| `RATE_001` <a id="rate_001" /> | Too many requests | 429  |

Any route can answer `RATE_001`: the limiter is global, and it buckets by the
calling credential, then the user, then the IP. The response carries a
`Retry-After` header, and the same number of seconds in the `retryAfter`
member. Wait that long before retrying.

## Hosts

A host is a machine someone paired with this control plane. It belongs to the
**person** who paired it, not to a workspace, so a host they cannot reach reads
as missing rather than forbidden — the scoped query cannot see it, and saying so
would confirm the id.

| Code                             | Title                                       | HTTP |
| -------------------------------- | ------------------------------------------- | ---- |
| `HOSTS_001` <a id="hosts_001" /> | Host not found                              | 404  |
| `HOSTS_002` <a id="hosts_002" /> | Pairing token not found                     | 404  |
| `HOSTS_003` <a id="hosts_003" /> | The registration token was rejected          | 401  |
| `HOSTS_004` <a id="hosts_004" /> | Hosts are not configured on this server      | 503  |
| `HOSTS_005` <a id="hosts_005" /> | The host assertion was rejected              | 401  |
| `HOSTS_006` <a id="hosts_006" /> | Too many pairing tokens are open             | 429  |
| `HOSTS_007` <a id="hosts_007" /> | No file is waiting for that command          | 404  |
| `HOSTS_008` <a id="hosts_008" /> | The host is not connected                    | 409  |

Two of these are deliberately opaque, and both would otherwise be an oracle for
guessing a credential:

- `HOSTS_003` does not distinguish a token that was already used, one that
  expired, one that was revoked and one that never existed. Its `detail` names
  all four at once and the runner prints that sentence verbatim. The one case it
  *does* tell apart is a machine retrying after a lost response: presenting the
  key the spent token already paired returns the same host, so a dropped answer
  never pairs a machine twice.
- `HOSTS_005` refuses a host's boot assertion without saying which check refused
  it. Its `detail` is a line for the operator's log, not a branch a client can
  take, and this page does not enumerate the reasons — a catalog that listed them
  would make the endpoint the oracle the single code exists to avoid.

`HOSTS_006` caps how many unspent pairing tokens one person may hold at once,
because each is a live way to add a machine to the account for its hour. Using
one, revoking one (`DELETE /v1/hosts/pairing/{id}`), or letting one expire frees
a slot. The console's "New token" mints with `replaces`, which revokes the token
on screen in the same write, so it never runs into the cap.

`HOSTS_004` is the optional-capability answer: without the runner release
settings and the control plane's own signing key there is nothing to hand a
machine that wants to pair, so the host routes say so and the rest of the API is
unaffected.

`HOSTS_008` answers Update runner (`POST /v1/hosts/{id}/update`) for a host
with no live link: the request goes down the link, so there is nothing to send
it on. A runner that is offline checks for updates itself when it comes back.

Note the prefix is plural. The Go runner owns `HOST_00x` and `PAIR_00x` below,
and a code may only be claimed once.

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

## Feature flags

Flags are declared in code; the database holds only their targeting, so a key
the catalog does not know is `FLAG_001` whatever the database says.

| Code                           | Title                                    | HTTP |
| ------------------------------ | ---------------------------------------- | ---- |
| `FLAG_001` <a id="flag_001" /> | Feature flag not found                   | 404  |
| `FLAG_002` <a id="flag_002" /> | The targeting is not valid for this flag | 422  |
| `FLAG_003` <a id="flag_003" /> | This feature is not available            | 403  |
| `FLAG_004` <a id="flag_004" /> | Segment not found                        | 404  |
| `FLAG_005` <a id="flag_005" /> | A segment with this key already exists   | 409  |
| `FLAG_006` <a id="flag_006" /> | The segment is still targeted by a flag  | 409  |
| `FLAG_007` <a id="flag_007" /> | The segment conditions are not valid     | 422  |

`FLAG_003` is what an endpoint behind `@RequireFlag` answers while its flag is
off for the caller — minting an API token while `api_token_creation` is
switched off, for example. `FLAG_002` and `FLAG_007` list every problem with
the submitted targeting in `detail`.

## GitHub installations

A GitHub App installation is the whole of what a workspace may reach on GitHub:
the installation is the access control and GitHub enforces it, so there is no
repository table and no mirror. A repository that leaves an installation is not
a state change here — it is simply absent from the next listing, and the next
token mint fails. Mints are never cached, so "the next mint" is the next time a
session asks.

| Code                                 | Title                                                          | HTTP |
| ------------------------------------ | -------------------------------------------------------------- | ---- |
| `GITHUB_001` <a id="github_001" /> | GitHub installation not found                                  | 404  |
| `GITHUB_002` <a id="github_002" /> | The GitHub App is not configured on this server                | 503  |
| `GITHUB_003` <a id="github_003" /> | That GitHub installation is already connected to another workspace | 409 |
| `GITHUB_004` <a id="github_004" /> | GitHub does not list that installation for your account         | 403  |
| `GITHUB_005` <a id="github_005" /> | GitHub rejected the authorization code                         | 400  |
| `GITHUB_006` <a id="github_006" /> | GitHub installations are connected inside an organization      | 400  |
| `GITHUB_007` <a id="github_007" /> | Invalid GitHub webhook signature                               | 400  |
| `GITHUB_008` <a id="github_008" /> | That GitHub installation is suspended or no longer installed   | 409  |
| `GITHUB_009` <a id="github_009" /> | GitHub could not be reached or rejected the request            | 502  |
| `GITHUB_010` <a id="github_010" /> | That repository is not covered by this GitHub installation     | 404  |
| `GITHUB_011` <a id="github_011" /> | The GitHub installation was not started from this workspace    | 400  |
| `GITHUB_012` <a id="github_012" /> | Connect GitHub again to review and merge in your name          | 409  |
| `GITHUB_013` <a id="github_013" /> | Pull request not found                                         | 404  |
| `GITHUB_014` <a id="github_014" /> | GitHub would not merge this pull request yet                   | 409  |
| `GITHUB_015` <a id="github_015" /> | GitHub's rate limit was reached; try again shortly             | 429  |
| `GITHUB_016` <a id="github_016" /> | Issue not found                                                | 404  |
| `GITHUB_017` <a id="github_017" /> | GitHub refused access to this repository's issues              | 403  |

`GITHUB_001` is also returned for an installation that exists but belongs to
another workspace; distinguishing the two would confirm the id.

`GITHUB_003` means another workspace **holds** the installation right now, not
that one once did. A workspace that disconnects, or an App uninstalled on
GitHub, frees the installation for anyone to connect: the id is unique among
live rows only, and the disconnected row is kept as history.

`GITHUB_004` is the claim proof, and it has no fallback. `POST /installations`
exchanges the OAuth code GitHub attaches to the install redirect and asks GitHub
which installations the authorizing account can see. Matching the installation's
account login against a linked GitHub account instead would refuse every
organization installation, where that login is the organization and not a user.

`GITHUB_011` is the other half of that proof. The code binds a claim to *a*
GitHub account, not to the console user whose browser posts it, so a callback
URL someone stopped halfway through their own install would otherwise connect
their installation to whoever opened it. An install therefore starts with
`POST /installations/install-state`, which mints a single-use state bound to the
caller and the workspace for 15 minutes; GitHub echoes it on the redirect, and
`POST /installations` spends it before it calls GitHub. Missing, expired, already
used, someone else's and another workspace's are one code, with no detail saying
which: telling them apart would make the endpoint a probing oracle.

`GITHUB_002` also covers a credential GitHub itself rejected: a `401` from the
App's own JWT is a deployment problem, not a caller's, and reporting it as one
sends whoever hit it to the right place.

`GITHUB_012` comes from a review, a comment or a merge: they are made with the
caller's own GitHub user token, kept sealed from the install's authorization,
never with the App's. There is none to use when the caller never installed the
App from this console, or GitHub refused to refresh it. Connecting GitHub again
stores a fresh one.

`GITHUB_014` is GitHub refusing the merge (checks, a required review, a branch
protection rule, a conflict, a head that moved). A merge a bot's approval card
carried out is pinned to the head the card showed, so a push while the card
waited is this code too, without GitHub being asked. Nothing bypasses it: the pull
request waits. Approve and merge answers `200` with `merged: false` instead of
this code, because the approval itself landed; it then asks GitHub to merge it
once the required checks pass (`autoMerge: true`), or leaves it waiting when
the repository does not allow auto-merge (`autoMerge: false`). If GitHub refuses that
request for another reason, the answer is `GITHUB_015` for a rate limit and
`GITHUB_009` otherwise; the approval has still landed.

`GITHUB_015` is GitHub's rate limit: the primary hourly budget of an
installation, a user token or the App, or a secondary limit. GitHub refuses
some of these with a `403`, and this code is what keeps them from reading as
`GITHUB_008` or `GITHUB_010`. The response carries `Retry-After` and
`retryAfterSeconds`, and until then the API does not ask GitHub again for that
budget on anyone's behalf: the same request answers `GITHUB_015` straight
away, on every replica. It is also the answer when one server already has too
many GitHub requests waiting: a page that fans out that far is refused with a
short `Retry-After` rather than left hanging.

`GITHUB_016` and `GITHUB_017` come from a bot's issue tools (`list_issues`,
`get_issue`, `create_issue`, `comment_on_issue`), which no route exposes yet.
`GITHUB_016` is also a number that belongs to a pull request: GitHub numbers
the two alike, and the pull request tools read those. `GITHUB_017` is GitHub's
`403` on an issue route: the App was registered before it asked for the
**Issues** permission, an owner has not accepted that permission on the
installation yet, or the person cannot write to the repository. Rate limits
on those routes are still `GITHUB_015`.

## Pull requests

The Pull requests area reads GitHub live through the workspace's installations
and keeps nothing of a pull request but which repositories the caller watches.

| Code                               | Title                                | HTTP |
| ---------------------------------- | ------------------------------------ | ---- |
| `PULLS_001` <a id="pulls_001" /> | Pull requests belong to a workspace  | 400  |
| `PULLS_002` <a id="pulls_002" /> | A pull request from a fork cannot be reviewed in a session yet | 409  |

`PULLS_002` answers a review session started on a pull request whose head
branch is in a fork: a host fetches the base repository's branches only.

## Projects

A project is a saved scope a person creates — the repositories its sessions usually
work on and the defaults a new session is offered. It is metadata only: a session's
directory and branch never name it. Its `slug` is a stable handle derived once from
its first name and never reissued. Every workspace also has one **Unassigned**
project, where a session that names no project is listed. See
`product/versions/mvp/10-api-modules-and-data-model.md`.

| Code                                   | Title                              | HTTP |
| -------------------------------------- | ---------------------------------- | ---- |
| `PROJECTS_001` <a id="projects_001" /> | Project not found                  | 404  |
| `PROJECTS_002` <a id="projects_002" /> | Projects belong to an organization  | 400  |
| `PROJECTS_003` <a id="projects_003" /> | Projects cannot be archived right now | 503 |
| `PROJECTS_004` <a id="projects_004" /> | That project is archived            | 409  |
| `PROJECTS_005` <a id="projects_005" /> | That project still has open sessions | 409 |
| `PROJECTS_006` <a id="projects_006" /> | A project’s repositories need a default, no repeats and a base branch each | 400 |
| `PROJECTS_007` <a id="projects_007" /> | No slug is free for that project   | 409  |
| `PROJECTS_008` <a id="projects_008" /> | The Unassigned project cannot be renamed or archived | 409 |
| `PROJECTS_009` <a id="projects_009" /> | That name belongs to the Unassigned project | 409 |

`PROJECTS_001` is also returned for a project that exists in another workspace:
the scoped read cannot see it, and distinguishing the two would confirm the id.

`PROJECTS_003` is archiving failing closed. "Is any session still open in this
project" is a question only the module that owns sessions can answer, asked over the
query bus; if nothing answers it, the archive refuses rather than assuming the answer
it would prefer.

`PROJECTS_006` is a repository list a project cannot hold: repositories with none
offered by default, one repository twice, more than twenty, or a blank base branch. The
`detail` names which. The request schema refuses the same bodies earlier; this is the
project holding its own invariants whatever the caller. An empty list is not
one of them: a project may hold no repository.

`PROJECTS_007` should never be seen: the last slug a new project tries carries part
of its own id. It is reported rather than retried.

`PROJECTS_008` protects the one project every workspace has for sessions that name
none. Its repositories and defaults can be edited like any project's; its name and
its place cannot.

`PROJECTS_009` keeps that project's name its own: another project named
"Unassigned", or the label any locale gives it ("Sin asignar"), in any case,
would list as a second Unassigned group. A project named so before the rule
keeps loading and can be renamed to anything else.

`PROJECTS_004` is no longer raised. It answered a session's first repository whose
auto-created project was archived; projects are no longer created from repositories,
and a session named for a retired project is `SESSIONS_006`. The code stays reserved
so it is never reused for something else.

## Sessions

A session is one piece of work inside a project: a terminal, an agent, and a set of
checkouts. Its append-only log is the truth per session and the row is a fold of it,
so nothing here reports a state the log does not explain. Rows are never
hard-deleted — closing a session keeps it for ever so its directory name and branch
are never reissued.

| Code                                   | Title                                           | HTTP |
| -------------------------------------- | ----------------------------------------------- | ---- |
| `SESSIONS_001` <a id="sessions_001" /> | Session not found                               | 404  |
| `SESSIONS_002` <a id="sessions_002" /> | Sessions belong to an organization              | 400  |
| `SESSIONS_003` <a id="sessions_003" /> | Checkout not found on this session              | 404  |
| `SESSIONS_004` <a id="sessions_004" /> | That repository is already checked out for this session | 409 |
| `SESSIONS_005` <a id="sessions_005" /> | That session is closed                          | 409  |
| `SESSIONS_006` <a id="sessions_006" /> | That project is archived                        | 409  |
| `SESSIONS_007` <a id="sessions_007" /> | That repository has used every directory name it can take here | 409 |
| `SESSIONS_008` <a id="sessions_008" /> | A terminal ticket could not be issued           | 503  |
| `SESSIONS_009` <a id="sessions_009" /> | A session must name its project (no longer raised) | 400 |
| `SESSIONS_010` <a id="sessions_010" /> | A session checks out one repository             | 409  |
| `SESSIONS_011` <a id="sessions_011" /> | This host's runner cannot start that agent      | 409  |
| `SESSIONS_012` <a id="sessions_012" /> | That file is too large to give the session      | 413  |
| `SESSIONS_013` <a id="sessions_013" /> | That is not a file the session can take         | 415  |
| `SESSIONS_014` <a id="sessions_014" /> | That session is stopped                         | 409  |
| `SESSIONS_015` <a id="sessions_015" /> | No file was attached                            | 400  |
| `SESSIONS_016` <a id="sessions_016" /> | The host is offline                             | 503  |
| `SESSIONS_017` <a id="sessions_017" /> | The host cannot take that file until its runner is updated | 409 |
| `SESSIONS_018` <a id="sessions_018" /> | That project does not include this session’s repository (no longer raised) | 409 |
| `SESSIONS_019` <a id="sessions_019" /> | An attached file is no longer waiting           | 410  |
| `SESSIONS_020` <a id="sessions_020" /> | Too many files are waiting to be sent           | 429  |
| `SESSIONS_021` <a id="sessions_021" /> | That session is not shared, or no longer        | 404  |
| `SESSIONS_022` <a id="sessions_022" /> | Sign in to open this shared session             | 401  |
| `SESSIONS_023` <a id="sessions_023" /> | This session is not shared with you             | 403  |
| `SESSIONS_024` <a id="sessions_024" /> | This session has as many share links as it can hold (no longer raised) | 409 |
| `SESSIONS_025` <a id="sessions_025" /> | This host's runner cannot start a session in a folder | 409 |
| `SESSIONS_026` <a id="sessions_026" /> | This host's runner cannot list its folders      | 409  |
| `SESSIONS_027` <a id="sessions_027" /> | The host is offline, so its folders cannot be listed | 503 |
| `SESSIONS_028` <a id="sessions_028" /> | That folder does not exist on the host          | 404  |
| `SESSIONS_029` <a id="sessions_029" /> | That path is not a folder                       | 422  |
| `SESSIONS_030` <a id="sessions_030" /> | That folder cannot be read on the host          | 403  |
| `SESSIONS_031` <a id="sessions_031" /> | The host did not answer in time                 | 504  |

`SESSIONS_001` is also returned for a session that exists in another workspace: the
scoped read cannot see it, and distinguishing the two would confirm the id.

`SESSIONS_021`–`SESSIONS_023` belong to sharing a session
(`product/versions/mvp/21-session-share-links.md`). `SESSIONS_022` comes first, for
anybody signed out, before the address is looked up, so a signed-out caller learns
nothing about it. `SESSIONS_021` is one answer for an address that was never shared,
a share stopped or expired, and a share of a closed session: the guest can only ask
for it to be shared again either way. `SESSIONS_023` is apart because its next step
is its own — ask to be named; a list of people matches a verified email only.
`SESSIONS_024` was twenty live share links on one session; since 2026-10-13 a
session has one share, and the code stays reserved so it is never reused.

`SESSIONS_025`–`SESSIONS_031` belong to sessions in a folder already on the host
(`product/versions/mvp/24-session-places.md`). `025` is a create with a `folder` for a
host whose live runner did not announce `session.folder`: it would refuse a session with
no checkouts, and updating the runner is the fix. A host with no link right now is not
refused: the session is recorded and its next hello is sent it. `026`–`031` answer the
folder picker, `GET /hosts/{id}/folders`, which asks the host's runner live and caches
nothing: `026` a runner that does not list folders (`fs.list`), `027` no link to the host,
`031` no answer within five seconds. `028`, `029` and `030` are the runner's own refusals,
`FS_001`, `FS_002` and `FS_003`, kept as the `upstreamCode` extension; any other refusal
a runner gives reads as `030`.

`SESSIONS_005` is what closing makes final. A closed session cannot be renamed,
stopped, restarted or given another checkout — the row is a tombstone for its
directory name, and reopening one would put new work into a directory a coding agent
already keys conversation state by.

`SESSIONS_009` is no longer raised. A session that names no project is listed in the
workspace's Unassigned project. The code stays reserved so it is never reused.

`SESSIONS_010` is the MVP's one repository per session: a runner makes one worktree
per session, so a second repository is refused here — on create by the body's own
limit, and on adding one to a session that has one — rather than by the host after
the session was written.

`SESSIONS_011` is a runner older than the agent that was picked. A runner probes
the command of every agent it can launch, installed or not, so a host whose last
inventory has no entry for that command runs a build that would refuse the
launch; updating the runner is the fix. Whether the agent is *installed* is never
checked here — that is a hint on the engine button, and the terminal says so.

`SESSIONS_018` is no longer raised. It refused a move to a project that did not hold the
session's repositories; a session moves to any project now, because a project is
metadata. The code stays reserved.

`SESSIONS_012`–`SESSIONS_017` belong to pasting a file into a session's prompt
(`POST /sessions/{id}/images`). A file is an image (PNG, JPEG, GIF, WebP), a PDF, or
UTF-8 text (plain, Markdown, CSV, JSON), judged by its bytes. `012` is the upload's cap;
`013` is bytes that are none of those, whatever the browser labelled them or the file
was named: an executable, an archive, a script with a `#!` line, SVG, HTML, text with
control bytes. `015` is a request with no file at all; `014` is a stopped session, which
has no window to paste into. `016` and `017` are the host: no link right now, or a
runner too old to take the command, or one that takes images but not PDF or text (it did
not announce `session.files`). A file is never queued for a host that comes back. A
runner that refuses the file anyway answers with `SESS_005` in the session's log, and
`HOSTS_007` is the runner's own pull finding nothing waiting.

The same refusals cover files attached to a session's first task. Each is uploaded
with `POST /sessions/attachments`, which answers `012`, `013` and `015` as a paste does,
and `020` when the caller already has as many uploads waiting as one person may. The
create that names them in `attachmentIds` answers `016` or `017` before it writes
anything, when the host cannot take them now, and `019` when an id is not waiting for
the caller: it expired, or it was never theirs. The two are one answer, so an id cannot
be probed.

`SESSIONS_007` is the end of a deliberately short list. A checkout's directory is
named `<repo>`, then `<owner>--<repo>`, then `<owner>--<repo>-<githubRepoId>`, and a
name is never reissued inside a session — so a session that has added, retired and
re-added one repository through all three has no name left for it. Reusing one would
put a fresh agent in a retired agent's working directory, which is the bug the
tombstone exists to prevent, so the answer is a refusal.

An oversized event payload is **not** an error code: the append reports it per row,
in the acknowledgement the runner reads, so one bad entry does not refuse a batch.

<!-- oppenheimer:begin runner -->
## Automations

An automation is a saved prompt, where it runs, and the triggers — a schedule or a
GitHub event — that start it. Every run is a session started as the automation's
owner. See `product/versions/mvp/16-automations-architecture.md`.

| Code                                         | Title                                       | HTTP |
| -------------------------------------------- | ------------------------------------------- | ---- |
| `AUTOMATIONS_001` <a id="automations_001" /> | Automation not found                        | 404  |
| `AUTOMATIONS_002` <a id="automations_002" /> | Automations belong to an organization       | 400  |
| `AUTOMATIONS_003` <a id="automations_003" /> | The automation was changed by someone else  | 409  |
| `AUTOMATIONS_004` <a id="automations_004" /> | A repository is not available to this workspace | 422 |
| `AUTOMATIONS_005` <a id="automations_005" /> | That agent cannot run an automation         | 422  |
| `AUTOMATIONS_006` <a id="automations_006" /> | A trigger would never fire                  | 422  |
| `AUTOMATIONS_007` <a id="automations_007" /> | That project cannot hold automations        | 422  |
| `AUTOMATIONS_008` <a id="automations_008" /> | Run not found                               | 404  |

`AUTOMATIONS_001` is also returned for an automation in another workspace, and for a
deleted one: its runs stay readable, but it cannot be edited or run.

`AUTOMATIONS_003` is optimistic concurrency: a save carries the `version` the editor
loaded, and a save over a newer one is refused rather than silently winning. Reload
and save again.

`AUTOMATIONS_005` names an agent with no unattended mode: one that launches no
command, has no permission levels, or names no models. The blank terminal is the
example.

`AUTOMATIONS_006` is a schedule trigger with no time left to fire at: a `once` in the
past, or a rule with nothing to fire on.

`AUTOMATIONS_007` is a project that is archived, or the workspace's Unassigned
project, which holds sessions that name none and no automations.

A run the owner can no longer start is not an error to the caller: it is recorded
on the run as `skipped` with a reason (`not_launchable`, `agent_unavailable`,
`overlapping`, the rate caps, `missed`), and a reason that would repeat every time
pauses the automation with a `pausedReason`.

## Bots

A bot is a worker you talk to: who it is, its soul and instructions with their
history, and what it remembers, kept in the API; its turns run on its home host.
See `product/versions/mvp/25-bots.md`.

| Code                                 | Title                                        | HTTP |
| ------------------------------------ | -------------------------------------------- | ---- |
| `BOTS_001` <a id="bots_001" />       | Bot not found                                | 404  |
| `BOTS_002` <a id="bots_002" />       | Bots belong to an organization               | 400  |
| `BOTS_003` <a id="bots_003" />       | Bot group not found                          | 404  |
| `BOTS_004` <a id="bots_004" />       | A group with that name already exists        | 409  |
| `BOTS_005` <a id="bots_005" />       | Bot document not found                       | 404  |
| `BOTS_006` <a id="bots_006" />       | The document was changed since it was loaded | 409  |
| `BOTS_007` <a id="bots_007" />       | Revision not found                           | 404  |
| `BOTS_008` <a id="bots_008" />       | Memory fact not found                        | 404  |
| `BOTS_009` <a id="bots_009" />       | The bot remembers as much as it can          | 422  |
| `BOTS_010` <a id="bots_010" />       | That model cannot run a bot                  | 422  |
| `BOTS_011` <a id="bots_011" />       | Model providers are not configured on this server | 503 |
| `BOTS_012` <a id="bots_012" />       | No such model provider                       | 404  |
| `BOTS_013` <a id="bots_013" />       | The bot's model provider has no key          | 409  |
| `BOTS_014` <a id="bots_014" />       | Turn not found                               | 404  |
| `BOTS_015` <a id="bots_015" />       | Approval not found                           | 404  |
| `BOTS_016` <a id="bots_016" />       | The approval was already decided             | 409  |
| `BOTS_017` <a id="bots_017" />       | ChatGPT connects by signing in, not with a key | 422 |
| `BOTS_018` <a id="bots_018" />       | The ChatGPT sign-in expired                  | 410  |
| `BOTS_019` <a id="bots_019" />       | ChatGPT's sign-in is busy; try again shortly | 429  |
| `BOTS_020` <a id="bots_020" />       | ChatGPT's sign-in could not be reached       | 502  |
| `BOTS_021` <a id="bots_021" />       | The ChatGPT sign-in is being refreshed       | 409  |
| `BOTS_022` <a id="bots_022" />       | The bot has a turn queued or running         | 409  |
| `BOTS_023` <a id="bots_023" />       | That model provider has no key               | 409  |
| `BOTS_024` <a id="bots_024" />       | That file is not an image a bot takes        | 415  |
| `BOTS_025` <a id="bots_025" />       | The image is too large                       | 413  |
| `BOTS_026` <a id="bots_026" />       | Image not found                              | 404  |
| `BOTS_027` <a id="bots_027" />       | The image can no longer be sent              | 409  |
| `BOTS_028` <a id="bots_028" />       | The bot's model does not read images         | 422  |

`BOTS_001`, `BOTS_003` and `BOTS_008` are also returned for a bot, group or fact in
another workspace.

`BOTS_004` compares names without case: "Engineering" and "engineering" are one
group.

`BOTS_005` is a document name other than `soul` and `instructions`, the two a bot
has.

`BOTS_006` is optimistic concurrency: a save carries the `baseRevision` the editor
loaded, and a save over a newer one is refused rather than silently winning. When
the save was stale, the problem's `revision` extension is the revision that is
current now. Reload and save again.

`BOTS_009` is a bot that already keeps 200 facts: it reads every one before each
turn. Forget one first.

`BOTS_010` is a model id the bot's provider does not offer
(`BOT_PROVIDER_CATALOG`); leave `model` null for the provider's default.

`BOTS_011` is a server with no `BOTS_PROVIDER_KEY`: no workspace can store a
model provider's key, so no bot can answer. `BOTS_012` is a provider other than
`anthropic`, `glm`, `openai` or `chatgpt` in `/model-providers/:provider`.

`BOTS_013` is a message to a bot whose provider has no key in the workspace;
store one in Settings → Model providers. A turn that finds the key gone when
it runs fails with the same words. `BOTS_014` is a turn that is not this bot's,
or not in the caller's workspace.

`BOTS_015` is an approval (a Needs input card) that is not this bot's, or not
in the caller's workspace. `BOTS_016` is a decision on one that was already
approved, denied, or expired because a new message was sent to the bot: read
the approvals again; the card is gone.

`BOTS_017` to `BOTS_021` are the ChatGPT provider, which runs on a sign-in to a
ChatGPT subscription instead of a key. `BOTS_017` is `PUT
/model-providers/chatgpt`: sign in with `POST /model-providers/chatgpt/login`
instead. `BOTS_018` is a poll of a sign-in that is past its fifteen minutes,
that ChatGPT refused, or that was started in another workspace; start again.
`BOTS_019` is OpenAI's sign-in server refusing for rate (or too many calls to it
waiting), with `Retry-After`. `BOTS_020` is that server not answering, or
answering something unusable. A ChatGPT sign-in that ChatGPT later refuses to
refresh is removed, and the bot's next turn fails with `BOTS_013`. `BOTS_021`
is a turn that needed the token refreshed while another API replica was
refreshing it; it fails at once rather than wait, and the next message runs on
the refreshed token.

`BOTS_022` is `DELETE /bots/:id/conversation` while one of the bot's turns is
queued or running: the turn would go on writing into a conversation that is
gone. Stop it (`POST /bots/:id/turns/:turnId/cancel`), then clear.
`BOTS_023` is making a provider the one new bots start on
(`PUT /model-providers/:provider/default`) when the workspace has no key for
it. Store the key first.

`BOTS_024` to `BOTS_028` are images in a bot's chat. An image is uploaded with
`POST /bots/:id/attachments` (one `file` per request) and then sent by naming
its id in `attachmentIds` on `POST /bots/:id/messages`. `BOTS_024` is a file
that is not PNG, JPEG, GIF or WebP; `BOTS_025` one larger than 5 MB.
`BOTS_026` is an id that is not this bot's or not in the caller's workspace,
or, when reading one, someone else's upload that was never sent. `BOTS_027`
is an image the message cannot claim: another message already carries it,
it is someone else's upload, or it was uploaded more than 23 hours ago and
the daily sweep may be deleting it. Pick the image again to send it. `BOTS_028` is an
upload or a message with images to a bot on a provider whose models read no
images (GLM); the message's words are not sent either, so nothing is lost:
remove the images, or switch the bot's model, and send again. An upload that
is never sent is deleted after a day.

A home host the caller may not use answers `HOSTS_001`, as a session's does.

## Voice

Dictation: a recording in, the text it says out, heard by the workspace's
ChatGPT sign-in or the deployment's own speech-to-text server
(`VOICE_STT_*`). See `product/next-steps/voice.md`.

| Code                                 | Title                                                        | HTTP |
| ------------------------------------ | ------------------------------------------------------------ | ---- |
| `VOICE_001` <a id="voice_001" />     | Dictation needs an active workspace                          | 400  |
| `VOICE_002` <a id="voice_002" />     | No audio was sent                                            | 400  |
| `VOICE_003` <a id="voice_003" />     | The recording is too long                                    | 413  |
| `VOICE_004` <a id="voice_004" />     | The recording is not 16-bit PCM WAV                          | 415  |
| `VOICE_005` <a id="voice_005" />     | Dictation is not set up for this workspace                   | 409  |
| `VOICE_006` <a id="voice_006" />     | The speech-to-text provider could not transcribe the recording | 502  |
| `VOICE_007` <a id="voice_007" />     | The speech-to-text provider is rate limiting this workspace  | 429  |

`VOICE_005` means nobody can hear the clip: sign the workspace in to ChatGPT
(Settings → Model providers), or give the deployment a speech-to-text server.
A ChatGPT sign-in that cannot transcribe (`VOICE_006`, or a lapsed sign-in)
falls back to the deployment's server when there is one; a rate limit
(`VOICE_007`, with `Retry-After`) does not.

## Inbox

The marks a person leaves on Inbox items: done, low, snoozed until a time,
or deleted. See `product/versions/mvp/28-inbox.md`.

| Code                                 | Title                                                        | HTTP |
| ------------------------------------ | ------------------------------------------------------------ | ---- |
| `INBOX_001` <a id="inbox_001" />     | The Inbox belongs to a workspace                             | 400  |
| `INBOX_002` <a id="inbox_002" />     | Not an Inbox item key                                        | 400  |
| `INBOX_003` <a id="inbox_003" />     | A snooze ends in the future                                  | 422  |
| `INBOX_004` <a id="inbox_004" />     | Inbox mark not found                                         | 404  |

An item key is `<kind>:<id>` in letters, digits and `:#@._-`, at most 200
characters, URL-encoded in the path. `INBOX_003` compares `until` with the
server's clock.

## Tasks

Plan's board: tasks, the milestones over them, and the sessions a task started or
links. See `product/versions/mvp/17-plan.md`.

| Code                                 | Title                                    | HTTP |
| ------------------------------------ | ---------------------------------------- | ---- |
| `TASKS_001` <a id="tasks_001" />     | Task not found                           | 404  |
| `TASKS_002` <a id="tasks_002" />     | Milestone not found                      | 404  |
| `TASKS_003` <a id="tasks_003" />     | Tasks belong to an organization          | 400  |
| `TASKS_004` <a id="tasks_004" />     | That project cannot take tasks           | 409  |
| `TASKS_005` <a id="tasks_005" />     | Session not found                        | 404  |
| `TASKS_006` <a id="tasks_006" />     | That position is no longer on the board  | 409  |
| `TASKS_007` <a id="tasks_007" />     | That milestone belongs to another project | 409 |
| `TASKS_008` <a id="tasks_008" />     | It changed since you read it             | 409  |

`TASKS_001`, `TASKS_002` and `TASKS_005` are also returned for a task, milestone or
session in another workspace.

`TASKS_004` is a project that is missing or archived: nothing new is filed under a
retired project.

`TASKS_006` is a move that named a task to land after which is no longer in that
column, or is the task being moved. The board was stale; reload it.

`TASKS_007` is a request whose milestone and project disagree. A milestone brings its own
project, so leave `projectId` out when choosing one.

`TASKS_008` is a write that named the version it read (`expectedVersion`, or
`If-Match` on a delete) after someone else had written the task or milestone.
Nothing changed; read it again and decide again. A write that names no version
always lands, and still moves the version on.

## Calendar

Plan's calendar: the workspace's own events, and a person's Google Calendar read
through to Google and never stored. See `product/versions/mvp/20-plan-calendar.md`.

| Code                                     | Title                                               | HTTP |
| ---------------------------------------- | --------------------------------------------------- | ---- |
| `CALENDAR_001` <a id="calendar_001" />   | Event not found                                     | 404  |
| `CALENDAR_002` <a id="calendar_002" />   | The calendar belongs to an organization             | 400  |
| `CALENDAR_003` <a id="calendar_003" />   | That range of days is too wide                      | 400  |
| `CALENDAR_004` <a id="calendar_004" />   | Google Calendar is not configured on this server    | 503  |
| `CALENDAR_005` <a id="calendar_005" />   | That Google Calendar connection was not started here | 400 |
| `CALENDAR_006` <a id="calendar_006" />   | Google did not grant read access to the calendar    | 400  |
| `CALENDAR_007` <a id="calendar_007" />   | Google Calendar is not connected                    | 409  |
| `CALENDAR_008` <a id="calendar_008" />   | Google Calendar did not answer                      | 502  |
| `CALENDAR_009` <a id="calendar_009" />   | An event ends after it starts, on its day           | 400  |
| `CALENDAR_010` <a id="calendar_010" />   | Google Calendar's rate limit was reached; try again shortly | 429 |
| `CALENDAR_011` <a id="calendar_011" />   | That is as many Google accounts as the calendar takes | 409 |

`CALENDAR_003` is a range that runs backwards or covers more than 62 days.

`CALENDAR_004` needs the Google sign-in client (`GOOGLE_CLIENT_ID`/`_SECRET`) and
`CALENDAR_TOKEN_KEY`; without them the calendar shows everything but Google.

`CALENDAR_005` is a connect `state` that is missing, expired, used, or someone
else's. Start again from Connect Google Calendar.

`CALENDAR_006` is Google refusing the code, returning no refresh token, or a
consent screen where the calendar permission was left unticked.

`CALENDAR_007` is no such connection of the caller's (a reconnect of an account
since removed), or one Google has since revoked (or one sealed under a
`CALENDAR_TOKEN_KEY` that was replaced): connect again.

`CALENDAR_011` is a sixth Google account: a person connects five at most.
Remove one, or reconnect one already listed, which does not count again.

## Inbound events

What external systems tell us — GitHub's webhook today — stored once and normalized
before any automation reads it.

| Code                                 | Title                                | HTTP |
| ------------------------------------ | ------------------------------------ | ---- |
| `INBOUND_001` <a id="inbound_001" /> | That event source is not known       | 400  |
| `INBOUND_002` <a id="inbound_002" /> | The delivery carries no delivery id  | 400  |

Neither reaches a person. `INBOUND_002` is a webhook delivery without GitHub's
`X-GitHub-Delivery` header, which is the key that makes a redelivery idempotent.

## Runner service

The Go runner (`apps/runner`) emits the same document shape with its own
catalog. `RUNNER_*` codes are the generic layer shared by every route; the
others belong to one bounded context each — `APIKEY_*` to credentials,
`HOST_*` to the host inventory (`FS_*` to its folder listing), `PAIR_*` to pairing, `SVC_*` to the service
unit, `UPD_*` to self-update, and `SESS_*`, `TMUX_*` and `GIT_*` to sessions. The host-agent codes also reach a person
through the runner's own CLI, where they set the exit code: 3 for a 401, 4 for a 403, 5
for a 404 or 428, 6 for a 502, 503 or 504, 7 for `PAIR_009`, and 1 for anything else.

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
| `HOST_006` <a id="host_006" />         | This machine looks temporary                 | 412  |
| `HOST_007` <a id="host_007" />         | The workspaces directory is not usable       | 400  |
| `HOST_008` <a id="host_008" />         | The runner's own directory is not safe to use | 412 |
| `HOST_009` <a id="host_009" />         | An agent CLI could not be updated            | 424  |
| `HOST_010` <a id="host_010" />         | The runner does not install this tool        | 400  |
| `HOST_011` <a id="host_011" />         | A tool could not be installed                | 424  |
| `FS_001` <a id="fs_001" />             | The folder does not exist                    | 404  |
| `FS_002` <a id="fs_002" />             | The path is not a directory                  | 400  |
| `FS_003` <a id="fs_003" />             | The folder cannot be read                    | 403  |
| `PAIR_001` <a id="pair_001" />         | This host is not paired yet                  | 428  |
| `PAIR_002` <a id="pair_002" />         | This host is already paired                  | 409  |
| `PAIR_003` <a id="pair_003" />         | The registration token was rejected          | 401  |
| `PAIR_004` <a id="pair_004" />         | The host key could not be read or written    | 500  |
| `PAIR_005` <a id="pair_005" />         | The control plane URL is not usable          | 400  |
| `PAIR_006` <a id="pair_006" />         | The control plane could not be reached       | 502  |
| `PAIR_007` <a id="pair_007" />         | The control plane is limiting registrations  | 429  |
| `PAIR_008` <a id="pair_008" />         | The control plane refused to unpair this host | 401  |
| `PAIR_009` <a id="pair_009" />         | This host was erased here but is still paired at the control plane | 502  |
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
| `SESS_005` <a id="sess_005" />         | The file cannot be given to the session      | 415  |
| `SESS_006` <a id="sess_006" />         | The session's folder is not on this host     | 404  |
| `SESS_007` <a id="sess_007" />         | The session's folder is not a directory      | 400  |
| `TMUX_001` <a id="tmux_001" />         | tmux is not available on this host           | 424  |
| `TMUX_002` <a id="tmux_002" />         | The tmux server refused the command          | 500  |
| `GIT_001` <a id="git_001" />           | The worktree could not be prepared           | 500  |
| `GIT_002` <a id="git_002" />           | A git command failed                         | 500  |
| `GIT_003` <a id="git_003" />           | The branch could not be pushed               | 409  |
| `GIT_004` <a id="git_004" />           | The repository needs a credential the runner could not supply | 403 |
| `GIT_005` <a id="git_005" />           | A git command was abandoned before it finished | 503 |

`HOST_008` stops `runner run` before it opens its control socket, so the
service keeps restarting into it. Its detail names the directory — the runner
home (`~/.oppenheimer`, or `RUNNER_HOME`) or its `run/` — and why. A home that
is a **symlink** (moved to another disk and linked back, say) was accepted by
earlier runners and is refused now, because the runner keeps its key and the
socket that hands out installation tokens only in a real directory it owns.
Put the real directory back in its place — `target="$(readlink -f
~/.oppenheimer)" && rm ~/.oppenheimer && mv "$target" ~/.oppenheimer` — or
point `RUNNER_HOME` at the real path (the service unit carries the value
`runner install` was run with, so install again with it set); then restart
the service (`systemctl --user restart oppenheimer-runner` or
`launchctl kickstart -k gui/$(id -u)/dev.oppenheimer.runner`). A directory
another account owns is fixed with `chown`; a mode looser than `0700` is
tightened by the runner itself.

`HOST_009` is `runner agents update` reporting that at least one agent CLI's
updater failed; the service only logs it and retries. What to do about it is
open question 4 of `product/versions/mvp/09-runner-install-and-update.md`.

`HOST_010` is `runner agents install` or `runner tools install` asked for
something it does not install: a name in neither catalog, a platform with no
installer, or `git`/`tmux`, which need root. For those two the detail is the
exact package-manager command to run. `HOST_011` is an install that ran and
failed, or finished without the tool appearing on `PATH`; the detail is the
installer's last line.

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

**Web.** `@oppenheimer/frontend-core` normalises failures into `AppError` via
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
   `packages/translations`, so the console can show it in the
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
