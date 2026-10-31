---
'@oppenheimer/backend-ddd': minor
'@oppenheimer/api': patch
'@oppenheimer/api-client': patch
'@oppenheimer/translations': patch
---

Optimistic concurrency is the default write of an existing aggregate.
`@oppenheimer/backend-ddd` adds `VersionedAggregateRoot` (the aggregate carries
the version its row was loaded at), `writeVersioned` (one `UPDATE … WHERE id
AND version` that bumps it, or throws `VersionConflictException`,
`GENERIC.VERSION_CONFLICT`), `TypeOrmRepositoryBase.saveVersioned` and
`retryOnVersionConflict`. Hosts are the first module on it: a host gets a
`version` column, a rename loaded before an unpair or an uninstall no longer
writes `unpairedAt` back to null, and an unpair racing the machine's uninstall
raises `HostUnpaired` and writes its timeline entry once. Rename retries once on
a fresh read; unpair and uninstall find the host already unpaired and write
nothing. Losing the retry too answers `HOSTS_009`.
