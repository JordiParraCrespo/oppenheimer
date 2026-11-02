---
'@oppenheimer/backend-core': minor
'@oppenheimer/api': patch
---

`@oppenheimer/backend-core` gains `configKeySealer`, the one sealer every module
that stores a secret binds to its own token, and `GoogleOAuthClient`, the Google
grant (consent URL, code exchange, access tokens, revocation, every call through
the integration's limiter) Gmail and the calendar now share. No behaviour
changes: the sealed layout and every error code are as before.
