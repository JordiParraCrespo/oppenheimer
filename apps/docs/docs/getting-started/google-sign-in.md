---
sidebar_position: 3
---

# Google sign-in

Oppenheimer ships with Google OAuth wired end to end — server, capability detection,
web button, mobile button. **No code changes are needed to turn it on.** What
is missing on a fresh clone is a pair of credentials from Google, because they
are per-deployment secrets that cannot live in the repository.

This page is the step-by-step for getting those credentials and switching the
provider on.

## What is already wired

| Piece                 | Where                                              | What it does                                                              |
| --------------------- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| Provider registration | `apps/api/src/auth/infrastructure/better-auth.config.ts`                        | Adds `socialProviders.google` **only** when both env vars are set         |
| Callback route        | Better Auth                                        | Serves `${BETTER_AUTH_URL}/api/auth/callback/google`                      |
| Name mapping          | `apps/api/src/auth/infrastructure/better-auth.config.ts` (`splitName`)          | Splits Google's `name` into the app's `firstName` / `lastName`            |
| Capability detection  | `apps/api/src/capabilities/capabilities.module.ts` | Resolves `google_oauth` from config at boot, logs it, serves it over HTTP |
| Capability endpoint   | `GET /api/v1/health/capabilities`                  | Tells clients whether the provider is configured                          |
| Web button            | `apps/web/src/components/social-login-buttons.tsx` | Renders only when the capability read says Google is available            |
| Mobile button         | `apps/mobile/app/(auth)/login.tsx`, `register.tsx` | Opens an in-app browser and deep-links back via the `oppenheimer://` scheme     |
| Sign-up gating        | `apps/api/src/auth/infrastructure/better-auth.config.ts` (`disableImplicitSignUp`) | Refuses a Google account with no user here, unless the caller asked to register |
| Account linking       | `apps/api/src/auth/infrastructure/better-auth.config.ts` (`account.accountLinking`) | Attaches Google to an existing email/password account on the same verified address |
| Post-sign-up hooks    | `apps/api/src/auth/infrastructure/better-auth.config.ts` (`databaseHooks`)      | Welcome email, default `user` role                                       |

A missing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` is not an error — it is a
disabled capability. The API boots normally, the button hides itself, and the
login page explains what to set.

## 1. Create a Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or pick an existing one) from the project switcher in the
   top bar.

You do **not** need to enable any API for basic sign-in: the OpenID Connect
endpoints Better Auth uses are always available. Only extra scopes (Drive,
Calendar, …) require enabling the matching API.

## 2. Configure the OAuth consent screen

In **APIs & Services → OAuth consent screen** (newer consoles put this under
**Google Auth Platform**):

1. **Audience** — pick **External** unless every user has an account in your
   Google Workspace organization, in which case **Internal** is simpler (no
   verification, no test-user list).
2. **Branding** — app name, support email, and the developer contact email.
   These are what the user sees on the Google consent screen, so use the
   product name rather than the project id.
3. **Scopes** — add `openid`, `.../auth/userinfo.email` and
   `.../auth/userinfo.profile`. These are Better Auth's defaults for Google and
   all that sign-in needs.
4. **Test users** — while the app is in _Testing_, only the Google accounts
   listed here can sign in. Add your own address now; everyone else gets
   `access_denied` until you publish.

## 3. Create the OAuth client ID

In **APIs & Services → Credentials → Create credentials → OAuth client ID**:

- **Application type**: **Web application** — even for the mobile app. Oppenheimer's
  mobile OAuth flow redirects to the **API**, not to the device, so the API's
  callback URL is the only redirect Google ever sees. You do not need an
  Android or iOS client.
- **Authorized JavaScript origins**: the origin the user's browser starts the
  flow from. The exchange happens server-side, so this is not strictly required
  — fill it in anyway, it costs nothing and avoids surprises if you ever add a
  browser-side Google flow.
- **Authorized redirect URIs**: `${BETTER_AUTH_URL}/api/auth/callback/google`,
  spelled out for every environment.

| Environment               | Authorized JavaScript origin | Authorized redirect URI                            |
| ------------------------- | ---------------------------- | -------------------------------------------------- |
| Local dev (web + mobile)  | `http://localhost:3000`      | `http://localhost:3001/api/auth/callback/google`   |
| Production, shared domain | `https://app.example.com`    | `https://app.example.com/api/auth/callback/google` |
| Production, split domains | `https://app.example.com`    | `https://api.example.com/api/auth/callback/google` |

The redirect URI must match `BETTER_AUTH_URL` **exactly** — scheme, host, port,
path, no trailing slash. A mismatch is the single most common failure, and
Google reports it as `redirect_uri_mismatch` before your app is ever reached.

:::note Google rejects plain HTTP except on localhost
`http://` redirect URIs are only allowed for `localhost` / `127.0.0.1`. A LAN
address like `http://192.168.1.20:3001/...` or the Android emulator's
`http://10.0.2.2:3001/...` will be refused when you save the client — see
[Testing on a physical device](#testing-on-a-physical-device).
:::

Copy the **Client ID** and **Client secret** from the dialog. The secret is
shown in full only here; you can create a new one later, but not re-read this
one.

## 4. Set the credentials

One `.env` at the repo root serves every app — never add a per-package one:

```bash
# .env
GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret
```

Check that `BETTER_AUTH_URL` is the public base URL of the API and matches the
host half of the redirect URI you registered:

```bash
BETTER_AUTH_URL=http://localhost:3001
```

Both variables are read by the API process only. Nothing about Google reaches
the client bundles — the web and mobile apps just ask the API whether the
provider exists.

:::note Containers do not inherit the root `.env`
The API image does not ship `.env`; the process only sees what its runtime
environment forwards. `docker/docker-compose.prod.yml` passes both variables
through to the `api` service, so a `.env` next to the compose file (or the same
names exported in the shell) is enough there. The Helm chart renders the API's
environment from `api.env` in `values.yaml`; add the pair there (or reference a
Secret). On any other target, use that platform's own secret wiring.
:::

## 5. Restart the API and verify

Environment is read once at boot, so a running API will not pick up the new
values:

```bash
pnpm dev
```

Two ways to confirm it took:

```text
[Capabilities] Deployment capabilities: google_oauth=on, github_oauth=off, ...
```

```bash
curl http://localhost:3001/api/v1/health/capabilities
# {"google_oauth":true,"github_oauth":false,"stripe_billing":false}
```

If `google_oauth` is `off`/`false`, the API did not see both variables — the
capability requires the id **and** the secret.

## 6. Try it

Open http://localhost:3000/login and click **Google**. The flow is:

1. The browser leaves for Google's consent screen.
2. Google redirects to `${BETTER_AUTH_URL}/api/auth/callback/google`.
3. Better Auth signs the user in — linking Google to the account they already
   have, when the address matches one — sets the session cookie, and redirects
   to `/dashboard`. A failure comes back to the screen the flow started from
   with `?error=<code>` appended.

On a **first** sign-up the standard hooks run, exactly as for email/password:
the display name is split into `firstName` / `lastName`, a welcome email is
queued, and the default `user` role is assigned. No organization is created —
the account belongs nowhere until it creates a workspace from onboarding or an
invitation puts it in one (the default `user` role may create organizations,
and `POST /v1/organizations` grants the creator the org-scoped role that opens
it), so the app sends it to onboarding rather than to a dashboard it has no
permission to read.

## Signing in and signing up are separate doors

Both providers set `disableImplicitSignUp: true`, so a Google account with no
user here **cannot** create one from the login screen: the callback comes back
with `?error=signup_disabled`. The login route reads that code and forwards the
person to `/register`, which says what happened and carries the same provider
buttons — those pass `requestSignUp`, the one flag that lifts the refusal.
Pressing **Google** there creates the account and signs them in.

So "Continue with Google" never quietly creates an account, and someone who
assumed they had one lands on the screen that can fix it rather than on an
error that cannot.

### An address that already has a password

If the Google address belongs to a user who signed up with email and password,
Better Auth attaches the Google identity to that account instead of forking a
second one, and from then on either method lands in the same place. Nothing has
to be done by hand and no password is asked for at the door.

Two checks guard that link, both configured under `account.accountLinking` in
`apps/api/src/auth/infrastructure/better-auth.config.ts`:

- **The provider must have verified the address.** `trustedProviders` is
  deliberately left empty, so what is trusted is Google's own `email_verified`
  claim, not the fact that the provider happens to be Google.
- **The existing account must have verified it too**
  (`requireLocalEmailVerified`). Sign-up here does not require verification, so
  without this check anyone could register a password account on an address
  they do not own and be handed the real owner's account the moment that person
  signed in with Google.

An account that never verified its email therefore gets `account_not_linked`,
which the login screen renders as "sign in with your password to continue".
Clicking the link in the verification email makes the next Google sign-in link
silently.

## Mobile

The mobile app needs no separate Google client. `apps/mobile/lib/auth-client.ts`
opens an in-app browser at the API, and the Expo plugin deep-links back into
the app with `oppenheimer://` once the API has finished the exchange. That scheme is
already a trusted origin on the API (`MOBILE_SCHEME`).

What must line up:

- `EXPO_PUBLIC_API_URL` points at the same API as `BETTER_AUTH_URL`.
- `MOBILE_SCHEME` matches the `scheme` in `apps/mobile/lib/auth-client.ts` and
  `app.config.ts` (all `oppenheimer` by default).

Unlike the web login card, the mobile login and register screens render their
Google and GitHub buttons unconditionally — they do not read
`GET /api/v1/health/capabilities`. On a deployment where the provider is not
configured, the mobile button leads to a provider error rather than hiding
itself.

The refusal codes above reach mobile less usefully than they do on web: the
Expo plugin closes the in-app browser on the redirect and keeps the URL, so a
`signup_disabled` ends the attempt without a message rather than forwarding to
the register screen. Somebody whose only credential is a Google account signs
up from the register screen's own provider buttons, which ask for the sign-up
explicitly.

### Testing on a physical device

A device cannot reach your machine's `localhost`, and Google will not accept a
LAN IP as a redirect URI. Put an HTTPS tunnel in front of the API instead:

```bash
cloudflared tunnel --url http://localhost:3001   # or: ngrok http 3001
```

Then set `BETTER_AUTH_URL` and `EXPO_PUBLIC_API_URL` to the tunnel's HTTPS URL,
add `https://<tunnel-host>/api/auth/callback/google` to the client's authorized
redirect URIs, and restart. Simulators and emulators that share the host's
network stack can keep using `localhost`.

## Going to production

- **Register the production redirect URI** on the same OAuth client (Google
  allows many), or create a separate client per environment and give each
  deployment its own `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
- **Publish the consent screen.** While the app is in _Testing_, sign-in works
  only for the listed test users. External + non-sensitive scopes (`openid`,
  `email`, `profile`) publish without Google's verification review.
- **Use HTTPS.** `BETTER_AUTH_URL` decides whether session cookies are marked
  `Secure`; an `http://` production URL means non-secure cookies.
- **Keep web and API same-origin where you can.** Session auth is cookie-based.
  The Docker web image already proxies `/api` to the API
  (`apps/web/nginx.conf`), so `BETTER_AUTH_URL` is the _web_ origin in that
  topology. If you split them across domains instead, the cookie is cross-site
  and you also need CORS (`FRONTEND_URL`) and cookie attributes to agree.
- **Treat the secret as a secret**: deployment environment or secret manager,
  never a `VITE_`/`EXPO_PUBLIC_` variable, never committed.

## Optional tweaks

All of these go on the `google` entry in `apps/api/src/auth/infrastructure/better-auth.config.ts`:

| Option                     | Effect                                                               |
| -------------------------- | -------------------------------------------------------------------- |
| `prompt: 'select_account'` | Always show the account chooser instead of silently reusing the last |
| `accessType: 'offline'`    | Ask for a refresh token (Google issues one on first consent only)    |
| `hd: 'example.com'`        | Restrict sign-in to one Google Workspace domain                      |
| Extra Google API scopes    | Possible too — see Better Auth's Google provider docs for the option name and shape, and enable the matching API in the console |

## Troubleshooting

| Symptom                                                 | Cause and fix                                                                                                              |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Error 400: redirect_uri_mismatch`                      | The registered URI differs from `${BETTER_AUTH_URL}/api/auth/callback/google`. Compare scheme, host, port and path.        |
| `Error 403: access_denied`                              | Consent screen still in _Testing_ and the account is not a test user, or Internal audience with an outside account.        |
| `Error 401: invalid_client`                             | Wrong or rotated client secret, or the id and secret come from different OAuth clients.                                    |
| No Google button on the login page                      | Capability is off. `GET /api/v1/health/capabilities` and the boot log tell you; a set-but-not-restarted API is typical.    |
| Button visible but the API says the provider is unknown | Env vars reached the shell but not the API process, or only one of the two is set.                                         |
| Google flow succeeds, app still logged out              | Cookie never made it back: `BETTER_AUTH_URL` on a different site from the web app, or `FRONTEND_URL` not a trusted origin. |
| Sign-in works on the simulator, not on a device         | The device cannot resolve `localhost` — use an HTTPS tunnel as above.                                                      |
| Back on `/register` with `?error=signup_disabled`       | Working as designed: no account here uses that Google account. Press **Google** on that screen to create one.              |
| `?error=account_not_linked` on the login page           | The address already has a password account whose email was never verified. Sign in with the password, or verify the address and retry. |
