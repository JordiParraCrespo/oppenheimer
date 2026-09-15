# QA pass — authentication

Every screenshot the `qa/` scenario pack produced on the run recorded in
`run-report.md`, taken against a live stack (Vite dev servers → NestJS API →
Postgres → Redis) with the pack's own fixtures applied. Names match the
`artifacts:` list in the scenario that produced them, so a capture can always be
traced back to the claim it was taken for.

The run is **7 passed, 1 failed** across eight scenarios. The failure is the
product, not the pack.

Every capture here is a **laptop screen** — 1440×900 at 2× scale, written out at
2880×1800. Where a screen does not fit a laptop, the run report says how much sat
below the fold rather than cropping it silently; see "The screenshots are a
laptop" in [`qa/README.md`](../../qa/README.md).

`run-report.md` is `qa/artifacts/report.md` with one edit, made by
`qa publish`: the captures live in a `screenshots/` subdirectory there and flat
here, so its image links are rewritten from `](screenshots/…` to `](./…`.

## The finding

| Capture                            | What it shows                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth-04d-invalid-reset-token.png` | A password-reset link whose token was never issued. The screen renders the whole reset form — two fields, a rules checklist and a submit button — and says nothing about the link being dead. The reader finds out only after filling it in. |

Every other negative path in AUTH-04 states its refusal: an invitation link with
no invitation says so (`auth-04e`), a guarded route redirects and keeps its
search params (`auth-04f`), and a wrong password and an unknown address are
refused in the same words (`auth-04a`, `auth-04b`), which is what keeps the pair
of them from being an account-enumeration oracle.

## Everything working

| Capture                                                       | What it shows                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `auth-01-superadmin-dashboard.png`, `admin-auth-01-…`          | The super admin, signed in to both apps, holding `manage all` rather than a suggestive role name.                                        |
| `auth-02-*`                                                    | Password reset end to end through the link read out of the mail sink: the form, the new password signing in, and the link refused on a replay. |
| `auth-03-invitation-accepted-admin.png` / `-member.png`        | Two invitations at two roles, each landing signed in, with the membership role and the application role both read back from Postgres.   |
| `auth-05-onboarding.png`, `auth-05-first-dashboard.png`        | A self-service registration sent to onboarding, told plainly it is in no workspace yet, then landed on its first dashboard.             |
| `auth-06-tenant-isolation.png`                                 | The owner of an empty workspace, shown their own tenant while another holds two thousand members.                                       |
| `auth-07-signed-out.png`, `auth-07-other-device-survives-sign-out.png` | Signing out removes the session row, and the second device rightly keeps its own — the two promises are separate.              |
| `auth-07-other-device-revoked.png`                             | The same second device after a password reset, now signed out: 0 session rows remain.                                                  |
| `admin-auth-08-owner.png`, `-admin.png`, `-plain-member.png`   | The control plane refusing three kinds of person by name, with a way out — not a blank shell, a spinner, or a bounce to the login form.  |
| `admin-auth-08-platform-admin.png`                             | The one person it admits.                                                                                                              |
