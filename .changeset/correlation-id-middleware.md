---
"@oppenheimer/backend-core": minor
"@oppenheimer/backend-ddd": patch
"@oppenheimer/api": patch
---

Open the request's correlation id in middleware, so a guard's refusal carries it.

- Removed: `RequestContextInterceptor`. Guards run before interceptors, so a
  401, 403 or 429 a guard threw went out with no `correlationId`.
- Added: `RequestContextMiddleware`, which the API applies to every route in
  `AppModule.configure`, and `resolveCorrelationId` / `isValidCorrelationId` /
  `CORRELATION_HEADER`. An inbound `x-correlation-id` is honoured only when it
  is 1–64 characters of `[A-Za-z0-9._:-]` (the first value of a repeated
  header); anything else becomes a fresh UUID.
- `buildPinoHttpOptions` sets `genReqId`, so the request log's `req.id` is the
  correlation id (no longer pino's counter), and every response, including the
  Better Auth routes, echoes it as `x-correlation-id`.
