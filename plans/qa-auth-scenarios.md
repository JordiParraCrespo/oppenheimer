# QA pack — auth theme, basic test cases

> **Built.** All eight scenarios are implemented in `qa/scenarios/auth/` and
> `qa/specs/auth/`. The first run is `docs/screenshots/qa-auth-pass/`.
> Two things this plan predicted came out differently: sign-up does **not**
> provision a workspace (AUTH-05 confirms the documented behaviour), and the
> repeated-wrong-password case was dropped from AUTH-04 because it trips the
> per-IP limiter that every other scenario shares. It is in `maturity.yaml`
> under `not-yet` with that reason.

The first theme of the [QA scenario pack](qa-scenario-pack.md). Every case
below becomes one `qa/scenarios/auth/<slug>.yaml` and one spec bound to its
id. Each takes the laptop screenshots named under **artifacts**, and each
compares what the screen says with what Postgres holds.

Grounding, so the cases match the product and not the CRM:

- Sign-up creates an **account**, not a workspace. An org-less account is sent
  to `/onboarding` (CLAUDE.md). The e2e sign-up spec still says "provisions a
  personal organization with an owner membership", so AUTH-05 has to settle
  which is true today and record it, rather than assume.
- `requireEmailVerification` is off; verification mail is sent but never
  required. `EMAIL_PROVIDER=console` is the mail sink.
- Two front doors. `apps/web` on 3000 (`/login`, `/register`,
  `/forgot-password`, `/reset-password`, `/accept-invitation`). `apps/admin-web`
  on 3003 has `/login`, `/forgot-password`, `/reset-password` and no register.
- Platform roles come from the seed: `superadmin@oppenheimer.dev`, `admin@oppenheimer.dev`,
  `user@oppenheimer.dev`. Everything the pack creates lives on `@qa.oppenheimer.dev`.
- Password reset revokes existing sessions (fix #114). OAuth is unconfigured
  in QA, and the login page must say so or hide the buttons.

## The scenarios

| id      | title                                                                      | severity | fixture  | existing e2e evidence to reuse via `execution.path`                  |
| ------- | -------------------------------------------------------------------------- | -------- | -------- | -------------------------------------------------------------------- |
| AUTH-01 | A super admin exists, signs in, and reaches the control plane              | critical | reset    | `tests/api/protected-routes.spec.ts` (admin can list users)          |
| AUTH-02 | A member resets a forgotten password and signs in with the new one         | critical | reset    | `tests/api/password-reset.spec.ts`, `tests/web/auth-ui.spec.ts`      |
| AUTH-03 | An invited person joins at the role they were invited as, signed in         | critical | reset    | `tests/web/invitation-acceptance.spec.ts`                            |
| AUTH-04 | Bad credentials, bad links and bad input all fail legibly                  | high     | reset    | `tests/api/sign-in.spec.ts`, `tests/web/auth-ui.spec.ts`             |
| AUTH-05 | A self-service registration is told where it stands                        | critical | reset    | `tests/web/onboarding.spec.ts`, `tests/api/sign-up.spec.ts`          |
| AUTH-06 | An owner of one workspace cannot read another workspace's data             | critical | baseline | none                                                                 |
| AUTH-07 | Signing out, and a reset, close every door they should                     | high     | reset    | `tests/api/session-security.spec.ts`                                 |
| AUTH-08 | The control plane refuses everyone who is not a platform administrator     | critical | roster   | `tests/web/nav-permissions.spec.ts` (partial)                        |

### AUTH-01 — super admin, elevated not merely named

Steps: sign in as `superadmin@oppenheimer.dev` on `apps/web`; read the profile the
API returns; sign in again on `apps/admin-web`; open `/users` and `/roles`.

Expected:
- The session belongs to the seed super admin, and `user.role` in the database
  is `superadmin`.
- `/users/me/permissions` holds `manage:all` or the equivalent, not a
  suggestive name with a thin rule set.
- The control plane admits them and `/users` lists the three seed accounts.
- The consumer app shows no control-plane chrome; the two apps look different.

Artifacts: `auth-01-superadmin-dashboard`, `admin-auth-01-superadmin-users`.

### AUTH-02 — password reset, end to end

Steps: create `reset.member@qa.oppenheimer.dev` via sign-up; request a reset from
`/forgot-password`; take the mail-sink count first, wait for one more
`[PASSWORD RESET]` line, open its URL; set a new password; sign in with it.

Expected:
- The request page confirms without saying whether the account exists.
- The link lands on `/reset-password` with a token, and the form accepts a
  password of the minimum length and refuses a shorter one in the browser.
- The new password signs in; the old one is refused.
- The link cannot be replayed: a second visit shows the invalid-link state.
- Every session open before the reset is gone from `session` in Postgres.

Artifacts: `auth-02-reset-requested`, `auth-02-reset-form`,
`auth-02-signed-in-with-new-password`, `auth-02-replayed-link`.

### AUTH-03 — invitation at a chosen role

Steps: as the baseline owner, invite `invitee.admin@qa.oppenheimer.dev` as admin and
`invitee.member@qa.oppenheimer.dev` as member through the team screen; read both
`[INVITATION]` URLs from the sink; open each as a newcomer and register from
the link; sign out; sign in again.

Expected:
- Accepting registers and joins in one step and lands signed in on the
  dashboard, not on `/onboarding`.
- `member.role` in Postgres is what the invitation said, and the application
  role (`user_role`) is what `applicationRoleFor` maps it to. The report
  records both, since the CRM found these disagreeing.
- On the second sign-in the invitee still holds the same role and workspace.
- The team roster shows both, with the right role badge.
- An existing account opening the link is returned to it after sign-in.

Artifacts: `auth-03-invitation-accepted-admin`,
`auth-03-invitation-accepted-member`, `auth-03-team-roster`.

### AUTH-04 — the negative paths (one scenario, lettered cases)

| case     | do                                                       | expect                                                                          |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------- |
| AUTH-04a | right address, wrong password                            | one rejection in the form, stays on `/login`, no user-vs-password distinction   |
| AUTH-04b | address with no account                                  | the same rejection; no enumeration                                              |
| AUTH-04c | malformed address                                        | `FieldError` in the browser, no request made                                    |
| AUTH-04d | `/reset-password` with a never-issued token              | invalid-link state offering a new request                                       |
| AUTH-04e | `/accept-invitation` with no id                          | invalid-link state, not a form that fails on submit                             |
| AUTH-04f | `/dashboard` while signed out, with search params        | redirect to `/login` carrying the destination; sign-in resumes it, params intact|
| AUTH-04g | `/register` on `apps/admin-web`                          | no such screen: 404 or redirect to login, never a working form                  |
| AUTH-04h | the same wrong password ten times                        | still no session; the response is a legible 429 or the same rejection, never 500|

Expected across all: no raw status code, no stack trace, no empty screen, no
spinner left running.

Artifacts: `auth-04a-wrong-password` … `auth-04h-throttled`.

### AUTH-05 — self-service first run

Steps: register `newcomer@qa.oppenheimer.dev` on `/register`; follow wherever the
app sends them; create a workspace; sign out; sign in again.

Expected:
- After registering, the account is signed in and lands on `/onboarding`,
  which says plainly that they are in no workspace yet and what to do.
- Postgres agrees: a `user` row, a `user_role` for the default role, and
  **no** `member` row until onboarding creates one. If the e2e claim of a
  personal organization turns out to be current behaviour, the scenario
  records that as a finding against CLAUDE.md, not as a pass.
- Onboarding refuses an empty workspace name in the browser.
- Creating the workspace lands on the dashboard; the second sign-in skips
  onboarding.
- A signed-in account with a workspace opening `/onboarding` is bounced off it.
- Welcome and verification mail both landed in the sink.

Artifacts: `auth-05-registered`, `auth-05-onboarding`,
`auth-05-first-dashboard`.

### AUTH-06 — tenant isolation

Steps: with `baseline` and `volume` both applied, sign in as the `empty`
fixture's owner; open the dashboard, the team page and settings; call the list
endpoints behind them.

Expected:
- Every count on screen is the empty tenant's, while another tenant holds
  thousands of rows. The oracle is a count scoped by `organizationId`.
- `GET` on members, invitations and API tokens returns only the caller's
  organization. A row id from the other tenant answers 404 or 403, not 200.
- The fixture owner is a tenant owner, not a platform admin: the scenario
  asserts `user.role = 'user'` before measuring, or the test is measuring the
  bypass and not the product.

Artifacts: `auth-06-tenant-isolation`.

### AUTH-07 — doors close

Steps: sign in on two browser contexts; sign out on one; then reset the
password from the second; then try the first again.

Expected:
- Sign-out drops the `session` row and the cookie; the dashboard is closed.
- A session cookie issued before sign-out no longer authenticates.
- After the reset, the other context is signed out too.
- The cookie is `httpOnly`; scripts on the page cannot read it.

Artifacts: `auth-07-signed-out`, `auth-07-other-device-revoked`.

### AUTH-08 — the control plane door

Steps: for each roster role (owner, admin, plain member, platform admin) sign
in on `apps/admin-web`.

Expected:
- Only the platform admin gets past the gate. Everyone else sees the
  `AccessDenied` card with a sign-out button, not a blank shell, a spinner or a
  redirect loop.
- The refusal is a refusal: the API behind `/users` answers 403 as a
  problem+json document, and the screen reads differently from a 500.
- The consumer app still admits all of them.

Artifacts: `admin-auth-08-<role>` for each role.

## Fixtures these need

- `reset`: delete every `@qa.oppenheimer.dev` account whose address does not start
  with `member` or `owner`, so the invitees and the newcomer can be created
  again. Also clears their `session`, `verification` and `invitation` rows.
- `baseline`, `volume`, `empty`: as in the main plan. AUTH-06 needs all three.
- `roster`: owner, admin, plain member, plus one account with `user.role =
  'admin'` for AUTH-08.

## Order of work

1. Harness, `reset` fixture, mail sink. AUTH-01, AUTH-04, AUTH-05 first: they
   need no data and prove the sink and the sign-in helper.
2. AUTH-02, AUTH-03, AUTH-07: the mail-driven flows.
3. `baseline`/`volume`/`empty`, then AUTH-06.
4. `roster`, then AUTH-08.
5. `qa publish qa-auth-pass` into `docs/screenshots/`, with the README naming
   which captures settle something.

## Deliberately not in this first pass

OAuth sign-in, email verification being required, session expiry by time,
invitation expiry and re-invitation, the mobile apps. Listed under `not-yet`
in `maturity.yaml` from day one.
