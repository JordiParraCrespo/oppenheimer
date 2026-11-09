---
'@oppenheimer/frontend-core': patch
---

Stop reporting a dropped connection to Sentry when it reached the reporter through a generated SDK call: the request's `AppError` now keeps the fetch `TypeError` itself as its cause.
