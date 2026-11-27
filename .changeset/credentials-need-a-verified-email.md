---
"@oppenheimer/api": minor
"@oppenheimer/cli": patch
"@oppenheimer/translations": patch
---

Credentials that outlive a session now need a verified email, and a password
reset takes them back.

- `@oppenheimer/api`: minting an API token, and approving or exchanging an
  OAuth (MCP) grant, is refused with `TOKEN_010` until the account's email is
  verified, and the token endpoint refuses a `code` or `refresh_token` that is
  not a string. A password reset ("Forgot password") takes back, in its own
  transaction, every credential issued before it: it sets the account's
  credential cutoff (a migration adds `credential_cutoff` and
  `api_token."issuedAt"`), from which every API token or OAuth grant whose
  chain began earlier, including a token minted by one, is refused; it deletes
  the account's OAuth grants, consents and unexchanged authorization codes; and
  the tokens are then marked revoked. Better Auth's
  rate limit keys on the client address `TRUST_PROXY` trusts (the socket's at
  `0`), never on `X-Forwarded-For` as sent. Social-login provider tokens are
  stored encrypted. A migration renames `oauthApplication."redirectURLs"` to
  the `redirectUrls` Better Auth writes, which had broken MCP client
  registration.
- `@oppenheimer/cli`: `opp login` on an unverified account says to verify the
  email first instead of pointing at a missing permission.
- `@oppenheimer/translations`: the message for `TOKEN_010`.
