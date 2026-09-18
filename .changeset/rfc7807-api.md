---
"@oppenheimer/api": minor
---

Serve every API error as an RFC 7807 problem document. `TOKEN_002` and
`TOKEN_005` now report the offending scopes in `detail` and as
`ungrantableScopes` / `missingScopes`, rather than interpolating them into the
catalog message.
