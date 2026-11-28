---
"@oppenheimer/api": minor
"@oppenheimer/cli": patch
"@oppenheimer/translations": patch
"@oppenheimer/frontend-core": minor
"@oppenheimer/frontend-web": minor
"@oppenheimer/web": patch
"@oppenheimer/mobile": patch
---

Credentials that outlive a session now need a verified email, and a password
reset takes back API tokens, OAuth grants and browser sessions.

- `@oppenheimer/api`: minting an API token, approving or exchanging an OAuth
  (MCP) grant, minting a host pairing token and issuing a routine's webhook
  URL are refused with `TOKEN_010` until the account's email is verified, on a
  deployment that delivers email (`email_delivery`: SMTP or Resend; without it
  no address can be verified, so the rule does not apply), and
  the token endpoint refuses a `code` or `refresh_token` that is not a string.
  A password reset ("Forgot password") takes back, in its own transaction, the
  API tokens and OAuth grants issued before it: it sets the account's
  credential cutoff (a migration adds `credential_cutoff` and
  `api_token."issuedAt"`), from which every API token or OAuth grant whose
  chain began earlier, including a token minted by one, is refused; it deletes
  the account's OAuth grants, consents and unexchanged authorization codes; and
  the tokens are then marked revoked. Browser sessions are signed out as
  before. Paired hosts and routine webhook URLs record whether the owner's
  email was verified when they were issued (a migration adds
  `"issuedVerified"` to `host_pairing_token`, `host` and
  `automation_webhook`, backfilled from the owner's address as it is now);
  a reset unpairs the hosts, revokes the unspent pairing tokens and revokes
  the webhook URLs issued unverified, which only a deployment without email
  delivery issues, and keeps the rest. `POST
  /v1/admin/users/{id}/set-password` now takes back what a reset does, and
  signs the account's sessions out; when it cannot, it answers `ADMIN_008`
  and is retried. A reset does not take back an OAuth exchange already past
  the grant gate at the instant of the reset (a window of milliseconds). If that transaction fails, the reset answers an error
  rather than success (the new password is already stored; resetting again
  from a new link completes it). Better Auth's
  rate limit keys on the client address `TRUST_PROXY` trusts (the socket's at
  `0`), never on `X-Forwarded-For` as sent. Social-login provider tokens are
  stored encrypted. A migration renames `oauthApplication."redirectURLs"` to
  the `redirectUrls` Better Auth writes, which had broken MCP client
  registration.
- `@oppenheimer/cli`: `opp login` on an unverified account says to verify the
  email first instead of pointing at a missing permission.
- `@oppenheimer/translations`: the message for `TOKEN_010`, and the copy of
  the console's Resend verification email action.
- `@oppenheimer/frontend-core`: `useSendVerificationEmail` and
  `IAuthClient.sendVerificationEmail`, a new verification link to the
  signed-in account's own address.
- `@oppenheimer/frontend-web`: `ErrorAlert` draws `TOKEN_010` with a Resend
  verification email action that says where the link went, or that it could
  not be sent (Add host, onboarding's host step, a routine's webhook URL, the
  MCP consent screen).
- `@oppenheimer/web`, `@oppenheimer/mobile`: their auth clients send the link
  through Better Auth's `send-verification-email`.
