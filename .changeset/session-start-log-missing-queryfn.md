---
'@oppenheimer/frontend-consumer': patch
---

A session's start log refreshes with the session again. While a session was
starting, a `session.changed` refetch of its start log rejected with
"Missing queryFn" (reported to Sentry), because the session screen's idle
watch on the same query had left it a `skipToken`; whether to read the log is
now `enabled`, so every observer hands the query a real `queryFn`.
