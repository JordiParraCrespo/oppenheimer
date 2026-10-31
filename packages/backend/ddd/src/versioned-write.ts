import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { VersionConflictException } from './exceptions';

/** What `writeVersioned` reads off the aggregate. */
export interface Versioned {
  readonly id: string;
  readonly version: number;
}

/**
 * The default write for an existing row: one `UPDATE … SET <record>,
 * "version" = "version" + 1 WHERE id = $id AND "version" = $version`, which
 * throws `VersionConflictException` unless it affected exactly one row.
 *
 * `Repository.save` cannot be used for this: it re-reads the row and writes
 * every column the instance holds, so an aggregate loaded before another
 * writer's change puts the old values back (a host renamed from a copy loaded
 * before it was unpaired came back paired). Here the
 * stale writer is refused instead, and since the throw rolls back the
 * transaction it runs in, the events and side rows it would have written go
 * with it.
 *
 * The `SET` list is the mapper's record minus its id, its version and every
 * field left `undefined`, so a column `toPersistence()` does not set is left
 * alone and `@UpdateDateColumn` is stamped by TypeORM. Run it on the manager
 * of the transaction that stages the aggregate's events, and call
 * `entity.markVersionWritten()` once that transaction has committed.
 */
export async function writeVersioned<Orm extends ObjectLiteral>(
  manager: EntityManager,
  target: EntityTarget<Orm>,
  entity: Versioned,
  record: Orm,
  idColumn = 'id',
): Promise<void> {
  const changes = Object.fromEntries(
    Object.entries(record).filter(
      ([key, value]) => value !== undefined && key !== idColumn && key !== 'version',
    ),
  );
  const result = await manager
    .createQueryBuilder()
    .update(target)
    // Cast around TypeORM's `QueryDeepPartialEntity` recursion, which cannot
    // represent jsonb columns (free-form records, arrays, unions).
    .set({ ...changes, version: () => '"version" + 1' } as QueryDeepPartialEntity<Orm>)
    .where({ [idColumn]: entity.id, version: entity.version })
    .execute();
  if (result.affected !== 1) {
    throw new VersionConflictException(
      `${entity.id} is no longer at version ${entity.version}; nothing was written`,
    );
  }
}

/**
 * Runs `attempt` again when it lost a versioned write, up to `attempts` times
 * in all (two by default: the first try and one retry). Each try must load the
 * aggregate afresh: the instance that lost was decided on a state that no
 * longer exists. The last conflict is rethrown for the caller to answer.
 */
export async function retryOnVersionConflict<T>(
  attempt: () => Promise<T>,
  { attempts = 2 }: { attempts?: number } = {},
): Promise<T> {
  for (let tries = 1; ; tries += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (tries < attempts && error instanceof VersionConflictException) continue;
      throw error;
    }
  }
}
