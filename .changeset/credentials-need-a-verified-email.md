---
"@oppenheimer/api": minor
"@oppenheimer/cli": patch
"@oppenheimer/translations": patch
---

Credentials that outlive a session now need a verified email, and a password
reset takes them back.

- `@oppenheimer/api`: minting an API token, and approving or exchanging an
  OAuth (MCP) grant, is refused with `TOKEN_010` until the account's email is
  verified. A password reset ("Forgot password") revokes every API token minted
  before it and deletes the account's OAuth grants and consents. Better Auth's
  rate limit keys on the client address `TRUST_PROXY` trusts (the socket's at
  `0`), never on `X-Forwarded-For` as sent. Social-login provider tokens are
  stored encrypted. A migration renames `oauthApplication."redirectURLs"` to
  the `redirectUrls` Better Auth writes, which had broken MCP client
  registration.
- `@oppenheimer/cli`: `opp login` on an unverified account says to verify the
  email first instead of pointing at a missing permission.
- `@oppenheimer/translations`: the message for `TOKEN_010`.
