---
"@oppenheimer/frontend-consumer": minor
---

The api-tokens repository drops the casts the loose OpenAPI types forced —
including a `dto as never` that was disabling type checking on the create-token
request body — and reads the generated DTOs directly.
