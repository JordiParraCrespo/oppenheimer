import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backs the four foreign keys that had no index at all
 * (`.agents/rules/database-design.md`: every foreign key is backed by an index
 * whose leading columns are the key's). Without one, a delete of the parent
 * scans the child table under lock, and so does every "children of X" query.
 * `apps/api/test/schema.integration.spec.ts` listed them as follow-ups of
 * 1790810000000-AddHotPathIndexesAndDropRedundant; with this migration the
 * list no longer carries them, so the test enforces them.
 *
 * Access patterns and what serves each:
 *   Q1 a `user` delete's RESTRICT check on `github_installation."installedByUserId"`
 *      (FK_github_installation_installed_by)   → IDX_github_installation_installed_by
 *   Q2 a `host` delete's SET NULL of `host_pairing_token."redeemedHostId"`
 *      (FK_host_pairing_token_host)            → IDX_host_pairing_token_redeemed_host
 *   Q3 an `organization` delete's cascade into `user_role`
 *      (FK_user_role_organization)             → IDX_user_role_organization
 *   Q4 a `role` delete's cascade into `user_role` (FK_user_role_role), and
 *      `bumpForRole`'s lookup of a role's holders (`WHERE "roleId" = $1`,
 *      `roles/database/authz-version.repository.ts`) on every edit or delete of
 *      an organization's role                  → IDX_user_role_role
 *
 * Q2 and Q3 are partial on `IS NOT NULL`: every lookup the key makes names a
 * parent, so the NULL rows (a token not yet redeemed, a global assignment)
 * would only make the index bigger. The schema test counts a partial index
 * as backing a key when its predicate is exactly this.
 *
 * IDX_user_role_user_org ("userId", "organizationId") and the two UQ_user_role_*
 * lead with `userId`, so none of them serves Q3 or Q4.
 *
 * The ORM entities declare each index under the same name, with `where:` for
 * the partial ones.
 *
 * `down()` drops the four.
 *
 * ---------------------------------------------------------------------------
 * Large databases (a table over 100k rows or 128 MB): run the ops script.
 *
 * Boot migrations share one transaction and hold every lock until it commits.
 * `CREATE INDEX` blocks writes to its table and `DROP INDEX` blocks reads too,
 * for the whole deploy. `user_role` grows with users times workspaces, and
 * blocking it blocks sign-up (which writes the owner's role). So on a large
 * table this migration only checks that the work is done, and fails with a
 * pointer here if it is not. Before deploying, run with psql in autocommit
 * mode `apps/api/db/ops/1790890000000-foreign-key-indexes.sql`; before
 * reverting, `apps/api/db/ops/1790890000000-foreign-key-indexes.rollback.sql`.
 * Both can be re-run. On small databases (development, CI, fresh installs) the
 * migration does all of it itself.
 * ---------------------------------------------------------------------------
 */

const OPS = 'apps/api/db/ops/1790890000000-foreign-key-indexes.sql';
const ROLLBACK = 'apps/api/db/ops/1790890000000-foreign-key-indexes.rollback.sql';

/** [table, name, definition, what `pg_get_indexdef` ends with]. */
type IndexSpec = [string, string, string, string];

const CREATED: IndexSpec[] = [
  // Q1
  [
    'github_installation',
    'IDX_github_installation_installed_by',
    `("installedByUserId")`,
    `USING btree ("installedByUserId")`,
  ],
  // Q2
  [
    'host_pairing_token',
    'IDX_host_pairing_token_redeemed_host',
    `("redeemedHostId") WHERE "redeemedHostId" IS NOT NULL`,
    `USING btree ("redeemedHostId") WHERE ("redeemedHostId" IS NOT NULL)`,
  ],
  // Q3
  [
    'user_role',
    'IDX_user_role_organization',
    `("organizationId") WHERE "organizationId" IS NOT NULL`,
    `USING btree ("organizationId") WHERE ("organizationId" IS NOT NULL)`,
  ],
  // Q4
  ['user_role', 'IDX_user_role_role', `("roleId")`, `USING btree ("roleId")`],
];

export class IndexUnbackedForeignKeys1790890000000 implements MigrationInterface {
  name = 'IndexUnbackedForeignKeys1790890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    for (const spec of CREATED) {
      await this.ensureIndex(queryRunner, spec);
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    for (const [table, name] of [...CREATED].reverse()) {
      await this.ensureNoIndex(queryRunner, table, name);
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  /** True when a table is too big to build or drop an index on it inside the boot transaction. */
  private async isLarge(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT c.reltuples > 100000 OR pg_total_relation_size(c.oid) > 128 * 1024 * 1024 AS large
         FROM pg_class c WHERE c.oid = $1::regclass`,
      [`"${table}"`],
    );
    return row.large === true;
  }

  /** Valid with the wanted definition, valid with another one, invalid, or missing. */
  private async indexState(queryRunner: QueryRunner, name: string, definition: string) {
    const [row] = await queryRunner.query(
      `SELECT i.indisvalid AS valid, pg_get_indexdef(i.indexrelid) AS definition
         FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace`,
      [name],
    );
    if (!row) return 'missing';
    if (!row.valid) return 'invalid';
    return (row.definition as string).endsWith(definition) ? 'valid' : 'outdated';
  }

  private async refuseIfLarge(queryRunner: QueryRunner, table: string, what: string, ops: string) {
    if (await this.isLarge(queryRunner, table)) {
      throw new Error(
        `${what} and "${table}" is too large to change it at boot. Run ${ops} first (see this migration's header).`,
      );
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    [table, name, definition, indexdef]: IndexSpec,
  ) {
    const state = await this.indexState(queryRunner, name, indexdef);
    if (state === 'valid') return;
    await this.refuseIfLarge(queryRunner, table, `${name} is ${state}`, OPS);
    if (state !== 'missing') await queryRunner.query(`DROP INDEX "${name}"`);
    await queryRunner.query(`CREATE INDEX "${name}" ON "${table}" ${definition}`);
  }

  private async ensureNoIndex(queryRunner: QueryRunner, table: string, name: string) {
    const [row] = await queryRunner.query(
      `SELECT 1 FROM pg_class c WHERE c.relname = $1 AND c.relnamespace = 'public'::regnamespace`,
      [name],
    );
    if (!row) return;
    await this.refuseIfLarge(queryRunner, table, `${name} is still there`, ROLLBACK);
    await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
  }
}
