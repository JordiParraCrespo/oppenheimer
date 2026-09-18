---
"@oppenheimer/backend-core": minor
---

`AllExceptionsFilter` answers with `application/problem+json` and the RFC 7807 members, plus `code`, `correlationId`, `timestamp` and `invalidParams`, in place of `{ statusCode, code, message }`. A 5xx no longer echoes the underlying message.
