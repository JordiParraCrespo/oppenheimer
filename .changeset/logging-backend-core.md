---
"@oppenheimer/backend-core": minor
---

`LoggingModule` wraps `nestjs-pino` with hardened defaults — request log lines
carry only known-safe fields (no headers, query strings, or bodies; credential
headers redacted as a backstop) — and registers `UserContextInterceptor`, which
attaches `userId` and the credential's effective scopes to the request log
context once the auth guards resolve. `createAuthRouteLoggingMiddleware` brings
the Better Auth `/api/auth/*` routes (mounted ahead of Nest's middleware) into
the request log via the `middleware` option of `@thallesp/nestjs-better-auth`.
