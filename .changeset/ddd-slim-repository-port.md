---
"@oppenheimer/backend-ddd": minor
"@oppenheimer/api": patch
---

Slim `RepositoryPort`, share the non-tenant TypeORM write path, and move
"wake after commit" into `OutboxService.transaction`.

- `@oppenheimer/backend-ddd`: `RepositoryPort` declares only `insert`, `save`,
  `findOneById` and `delete`. `findAll`, `findAllPaginated` and `transaction`
  are gone: nothing called `transaction`, and every implementation dropped the
  `EntityManager`, so writes made inside it never joined the transaction. A
  port that needs a list declares it. New `OutboxService.transaction(work)`
  runs `work` in one transaction and wakes the relay after commit when
  `stageEvents` (with at least one event) or `stageJob` ran on its manager;
  never after a rollback, never when nothing was staged. `writeWithEvents` is
  built on it. New `TypeOrmRepositoryBase<Aggregate, Orm>`: the port's four
  methods for a non-tenant adapter (map, write through `writeWithEvents`, map
  back), with `idColumn` for a table keyed by something other than `id`.
- `@oppenheimer/api`: the user, feature-flag, flag-segment and user-settings
  adapters extend `TypeOrmRepositoryBase`; roles and API tokens lose their dead
  `findAll` / `findAllPaginated` / `transaction`. Every repository that staged
  outbox rows in its own transaction (projects, inbound events, automations,
  automation runs, hosts, host metadata, sessions, the personal workspace) now
  opens it with `outbox.transaction` and keeps no `staged` flag or `wake()`
  call of its own.
