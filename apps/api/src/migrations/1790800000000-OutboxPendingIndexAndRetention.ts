import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Re-indexes `outbox_message` for the relay's claim and for the retention
 * purge that now keeps the table small.
 *
 * `AddOutbox` gave the table one index, `("status", "availableAt")`. The claim
 * filters on those columns but orders by `createdAt`, so every claim read and
 * sorted the whole due backlog before taking its 20 rows, and the relay claims
 * again and again until the backlog is gone. `status` and `availableAt` being
 * index keys also made every lease and every retry a non-HOT update, and the
 * index kept every `processed` and `failed` row. Nothing ever deleted a
 * `processed` row either, so the table and its index grew with every domain
 * event and every staged job.
 *
 * Access patterns and what serves each:
 *   Q1 the relay's claim: pending, due, unleased, oldest first,
 *      LIMIT n FOR UPDATE SKIP LOCKED                  → IDX_outbox_message_pending
 *      (partial: only the rows a relay can claim, in the claim's ORDER BY; the
 *      scan stops at LIMIT, with no sort)
 *   Q2 retention: processed rows older than N days,
 *      in batches                                      → IDX_outbox_message_created_brin
 *      (rows are inserted in `createdAt` order and processed seconds later, so
 *      a range over `createdAt` is a range over the heap; the delete filters
 *      `status = 'processed'` on the rows it reads)
 *   Q3 inspecting `failed` rows: manual and rare       → no index; a scan of a
 *      table the purge keeps small
 *
 * `IDX_outbox_message_status_available` is dropped: the claim was its only
 * reader. With no index on `status` outside the partial predicate, and none on
 * `availableAt` or the lease columns, the lease update in the claim and a retry
 * that stays `pending` are HOT-eligible; only `markProcessed` (which takes a
 * row out of the partial index) still writes an index entry.
 *
 * Alternatives considered. Q1 as `("availableAt") WHERE status = 'pending'`
 * would serve the `availableAt <= now()` range directly, but the claim would
 * have to order by `availableAt`, which changes delivery order from creation
 * order to due order, and listeners can see that. Q2 as a partial B-tree on
 * `("processedAt") WHERE status = 'processed'` gives an exact range but costs
 * an index entry on every delivery; BRIN costs next to nothing per write and
 * is what `inbound_event` and `host_event` already use for retention.
 *
 * Retention: `OutboxRetentionProcessor` (apps/api/src/outbox) deletes
 * `processed` rows older than 7 days, once a day, 5 000 rows per statement and
 * at most 200 statements per run. `pending` rows are owed and never purged;
 * `failed` rows are the inspection trail, few, and kept. The first run on a
 * table that was never purged removes at most 1M rows; the rest goes on the
 * following days. Past tens of millions of rows a day, the table is a
 * candidate for time partitioning with retention as a partition drop.
 *
 * `down()` recreates `IDX_outbox_message_status_available`, then drops the two
 * indexes this adds. The rows the purge deleted do not come back.
 *
 * ---------------------------------------------------------------------------
 * Large databases (outbox_message over 100k rows or 128 MB): run the ops script.
 *
 * Boot migrations share one transaction and hold every lock until it commits.
 * `CREATE INDEX` takes a SHARE lock that blocks every write to
 * `outbox_message` — every domain write in the app — for the whole deploy. So
 * on a large table this migration only checks that the indexes are in place,
 * and fails with a pointer here if they are not. Before deploying, run with
 * psql in autocommit mode `apps/api/db/ops/1790800000000-outbox-pending-index.sql`;
 * before reverting, `apps/api/db/ops/1790800000000-outbox-pending-index.rollback.sql`.
 * Both can be re-run. On small databases (development, CI, fresh installs) the
 * migration does all of it itself.
 * ---------------------------------------------------------------------------
 */

const OPS = 'apps/api/db/ops/1790800000000-outbox-pending-index.sql';
const ROLLBACK = 'apps/api/db/ops/1790800000000-outbox-pending-index.rollback.sql';
const TABLE = 'outbox_message';
const OLD_INDEX = 'IDX_outbox_message_status_available';

/** [name, definition] */
const INDEXES: [string, string][] = [
  // Q1
  ['IDX_outbox_message_pending', `("createdAt") WHERE "status" = 'pending'`],
  // Q2
  ['IDX_outbox_message_created_brin', `USING brin ("createdAt")`],
];

export class OutboxPendingIndexAndRetention1790800000000 implements MigrationInterface {
  name = 'OutboxPendingIndexAndRetention1790800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    for (const [name, definition] of INDEXES) {
      await this.ensureIndex(queryRunner, name, definition, OPS);
    }
    await this.dropIndex(queryRunner, OLD_INDEX, OPS);
    await queryRunner.query(`RESET lock_timeout`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    await this.ensureIndex(queryRunner, OLD_INDEX, `("status", "availableAt")`, ROLLBACK);
    for (const [name] of [...INDEXES].reverse()) {
      await this.dropIndex(queryRunner, name, ROLLBACK);
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  /** True when the table is too big to build or drop an index inside the boot transaction. */
  private async isLarge(queryRunner: QueryRunner): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT c.reltuples > 100000 OR pg_total_relation_size(c.oid) > 128 * 1024 * 1024 AS large
         FROM pg_class c WHERE c.oid = $1::regclass`,
      [`"${TABLE}"`],
    );
    return row.large === true;
  }

  /** Valid, invalid (an interrupted concurrent build) or missing. */
  private async indexState(queryRunner: QueryRunner, name: string) {
    const [row] = await queryRunner.query(
      `SELECT i.indisvalid AS valid
         FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace`,
      [name],
    );
    return row ? (row.valid ? 'valid' : 'invalid') : 'missing';
  }

  private async refuseIfLarge(queryRunner: QueryRunner, what: string, script: string) {
    if (await this.isLarge(queryRunner)) {
      throw new Error(
        `${what} and "${TABLE}" is too large to do it at boot. Run ${script} first (see this migration's header).`,
      );
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    name: string,
    definition: string,
    script: string,
  ) {
    const state = await this.indexState(queryRunner, name);
    if (state === 'valid') return;
    await this.refuseIfLarge(queryRunner, `${name} is ${state}`, script);
    if (state === 'invalid') await queryRunner.query(`DROP INDEX "${name}"`);
    await queryRunner.query(`CREATE INDEX "${name}" ON "${TABLE}" ${definition}`);
  }

  /** Dropping takes an ACCESS EXCLUSIVE lock, held until the boot transaction commits. */
  private async dropIndex(queryRunner: QueryRunner, name: string, script: string) {
    if ((await this.indexState(queryRunner, name)) === 'missing') return;
    await this.refuseIfLarge(queryRunner, `${name} is still there`, script);
    await queryRunner.query(`DROP INDEX "${name}"`);
  }
}
