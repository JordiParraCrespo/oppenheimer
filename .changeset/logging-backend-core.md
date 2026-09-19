---
"@oppenheimer/backend-core": minor
---

`LoggingModule` wraps `nestjs-pino` with hardened defaults — no headers, query strings or bodies in request lines — and attaches `userId` and the credential's effective scopes once the auth guards resolve.
