---
"@oppenheimer/backend-core": minor
---

Add `ApiAuthProblemResponses()`, which documents the 401/403 every guarded
route can produce, applied once per controller class. A test now pins the
deliberate rule that a bare `HttpException` carries no `code`.
