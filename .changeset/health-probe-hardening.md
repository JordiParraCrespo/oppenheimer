---
"@oppenheimer/api": minor
"@oppenheimer/api-client": patch
---

The probes say less and decide more strictly.

- `GET /api/v1/health` checks nothing but that the process answers, and always
  serves `{ "status": "ok" }`. The 200 MB heap check is gone: it restarted a
  busy process at its peak.
- `GET /api/v1/ready` checks PostgreSQL (`SELECT 1` on the app's own pool) and
  Redis (`PING`) concurrently, each within its own deadline
  (`HEALTH_DATABASE_TIMEOUT_MS`, `HEALTH_REDIS_TIMEOUT_MS`), counts
  only an explicit "up" as up, and answers
  `{ status, checks: { database, redis } }` with one word for a failure; the
  reason is logged. The heap and disk thresholds are no longer part of it.
- **Response shape:** both bodies replace Terminus' `info`/`error`/`details`.
  Nothing in the repository read them.
- `@nestjs/terminus` is no longer a dependency: nothing uses it.
