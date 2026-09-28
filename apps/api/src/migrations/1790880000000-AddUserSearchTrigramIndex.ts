import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A trigram index for the admin user search.
 *
 * The query it serves is `UserRepository.findUsers` with a `search` term
 * (`GET /v1/users?search=`): three `ILIKE '%term%'` conditions OR'd across
 * `"firstName"`, `"lastName"` and `"email"`, the term's own `%` and `_`
 * escaped (`likeContains`). A B-tree cannot serve a leading wildcard, so every
 * search was a sequential scan of `user`, twice (the page and its count). One
 * multi-column GIN with `gin_trgm_ops` on each column serves all three: the
 * planner answers the OR with a BitmapOr of three scans of this one index.
 *
 * - Trigrams help only for a term of three characters or more. A shorter term
 *   yields no trigram to look up and still scans; that is acceptable for an
 *   admin search, where one or two characters select most of the table anyway.
 * - `pg_trgm` is a trusted extension since Postgres 13, so the database owner
 *   can create it without a superuser. `down()` leaves it installed: other
 *   objects may use it by then, and an unused extension costs nothing.
 * - `user` is a Better Auth table (`.agents/rules/database-design.md`, "Two
 *   kinds of table"). An index is allowed; no column changes.
 * - The index is declared on `UserOrmEntity` with `synchronize: false`, since
 *   TypeORM cannot express GIN.
 *
 * ---------------------------------------------------------------------------
 * Large databases (`user` over 100k rows or 128 MB): run the ops script.
 *
 * Boot migrations share one transaction and hold every lock until it commits.
 * `CREATE INDEX` takes a SHARE lock that blocks every write to `user`, sign-ups
 * and sign-ins included, for the whole deploy; `CREATE INDEX CONCURRENTLY`
 * cannot run in a transaction, and the data sources run
 * `migrationsTransactionMode: 'all'`. So on a large `user` table this migration
 * only checks that the index exists and is valid, and fails with a pointer here
 * if it is not. Before deploying, run with psql in autocommit mode
 * `apps/api/db/ops/1790880000000-user-search-trigram-index.sql`; before
 * reverting, `apps/api/db/ops/1790880000000-user-search-trigram-index.rollback.sql`.
 * Both can be re-run. On small databases (development, CI, fresh installs) the
 * migration builds or drops the index itself.
 * ---------------------------------------------------------------------------
 */

const OPS = 'apps/api/db/ops/1790880000000-user-search-trigram-index.sql';
const ROLLBACK = 'apps/api/db/ops/1790880000000-user-search-trigram-index.rollback.sql';

const NAME = 'IDX_user_search_trgm';
const DEFINITION = `USING gin ("firstName" gin_trgm_ops, "lastName" gin_trgm_ops, "email" gin_trgm_ops)`;
/** What `pg_get_indexdef` ends with for the index above. */
const INDEXDEF = `USING gin ("firstName" gin_trgm_ops, "lastName" gin_trgm_ops, email gin_trgm_ops)`;

export class AddUserSearchTrigramIndex1790880000000 implements MigrationInterface {
  name = 'AddUserSearchTrigramIndex1790880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    const state = await this.indexState(queryRunner);
    if (state !== 'valid') {
      await this.refuseIfLarge(queryRunner, `${NAME} is ${state}`, OPS);
      if (state !== 'missing') await queryRunner.query(`DROP INDEX "${NAME}"`);
      await queryRunner.query(`CREATE INDEX "${NAME}" ON "user" ${DEFINITION}`);
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    if ((await this.indexState(queryRunner)) !== 'missing') {
      await this.refuseIfLarge(queryRunner, `${NAME} is still there`, ROLLBACK);
      await queryRunner.query(`DROP INDEX IF EXISTS "${NAME}"`);
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  /** True when `user` is too big to build or drop an index on it inside the boot transaction. */
  private async isLarge(queryRunner: QueryRunner): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT c.reltuples > 100000 OR pg_total_relation_size(c.oid) > 128 * 1024 * 1024 AS large
         FROM pg_class c WHERE c.oid = '"user"'::regclass`,
    );
    return row.large === true;
  }

  /**
   * Valid with the wanted definition, valid with another one, invalid (an
   * interrupted concurrent build) or missing.
   */
  private async indexState(queryRunner: QueryRunner) {
    const [row] = await queryRunner.query(
      `SELECT i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition
         FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace`,
      [NAME],
    );
    if (!row) return 'missing';
    if (!row.valid) return 'invalid';
    return (row.definition as string).endsWith(INDEXDEF) ? 'valid' : 'outdated';
  }

  private async refuseIfLarge(queryRunner: QueryRunner, what: string, ops: string) {
    if (await this.isLarge(queryRunner)) {
      throw new Error(
        `${what} and "user" is too large to change it at boot. Run ${ops} first (see this migration's header).`,
      );
    }
  }
}
