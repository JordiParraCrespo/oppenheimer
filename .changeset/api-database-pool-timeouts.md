---
"@oppenheimer/api": patch
---

Bound both Postgres pools. TypeORM's and Better Auth's pools are sized by
`DB_POOL_MAX` (10) and `DB_AUTH_POOL_MAX` (5), fail a query that waits longer
than `DB_CONNECTION_TIMEOUT_MS` (5 s) for a free connection, and send
`statement_timeout` (`DB_STATEMENT_TIMEOUT_MS`, 15 s), `lock_timeout`
(`DB_LOCK_TIMEOUT_MS`, 5 s) and `idle_in_transaction_session_timeout`
(`DB_IDLE_IN_TRANSACTION_TIMEOUT_MS`, 30 s) to Postgres, with
`application_name` `api` and `api-auth`. Boot migrations run first on a
single connection of their own (`api-migrations`) without those timeouts.
