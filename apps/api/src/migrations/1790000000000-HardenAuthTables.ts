import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives Better Auth's `session`, `account`, `verification` and `invitation`
 * tables the foreign keys, unique key and indexes they were created without,
 * and the first migration's constraints readable names. Ported from the Flama
 * starter's `HardenAuthTables` (flama#158); the `timestamptz` half of that
 * change was already done here by `StoreTimestampsWithTimeZone`.
 *
 * `session."userId"` and `account."userId"` had neither a foreign key nor an
 * index, and `DeleteUserCommandHandler` deletes the `user` row directly, so a
 * deleted user's sessions and credentials (password hash, OAuth tokens)
 * stayed behind. The other ids on `session` were as bare:
 *
 *   userId               → user          CASCADE   a session means nothing without its user
 *   impersonatedBy       → user          CASCADE   an impersonation ends with the admin doing it
 *   activeOrganizationId → organization  SET NULL  the session outlives the workspace it had open
 *   activeTeamId         → team          SET NULL  same; a team is deleted with its organization
 *   account.userId       → user          CASCADE   a login means nothing without its user
 *
 * `delegatedCredentialId` stays without a key: it names either an `api_token`
 * row or an OAuth grant's digest prefix, so it has no single table to point at,
 * and the delegated session it marks already cascades with its user.
 *
 * `invitation` already had its foreign keys (`AddAdminAndOrganizations`) but
 * not the indexes behind two of them: `inviterId` (CASCADE from `user`) and
 * `teamId` (SET NULL from `team`) are indexed here, so a user or team delete
 * does not scan it. The console sends no invitations today, so the table is
 * empty; the indexes cost nothing until it is not.
 *
 * `account ("providerId", "accountId")` becomes unique: Better Auth resolves
 * every social sign-in by that pair, and two rows for one provider account
 * would sign in whichever it read first. Existing duplicates are deleted,
 * keeping the most recently updated row (the one holding current tokens).
 *
 * What was already in place and is left alone: every foreign key on `member`,
 * `team`, `teamMember`, `invitation`, `api_token`, `oauth*`, `user_role` and
 * `user_settings`, and the product tables (`host*`, `github_installation`,
 * `project*`, `work_session*`, `session_checkout`), which were designed with
 * theirs. Nothing here changes what a user delete does to those: the
 * `RESTRICT` keys from `github_installation` and `work_session` still refuse
 * it while the user has any.
 *
 * Access patterns and what serves each:
 *   Q1 session by token (every request)             → UQ_session_token
 *   Q2 a user's sessions; cascade on user delete     → IDX_session_userId
 *   Q3 cascades from user / organization / team      → IDX_session_impersonatedBy,
 *                                                      IDX_session_activeOrganizationId,
 *                                                      IDX_session_activeTeamId (partial: mostly null)
 *   Q4 a user's accounts; cascade on user delete     → IDX_account_userId
 *   Q5 account by provider + provider's id           → UQ_account_providerId_accountId
 *   Q6 newest verification for an identifier         → IDX_verification_identifier_createdAt
 *   Q7 expired verifications                         → IDX_verification_expiresAt
 *   Q8 cascades from user / team into invitation     → IDX_invitation_inviterId,
 *                                                      IDX_invitation_teamId (partial: mostly null)
 *
 * Retention: `verification` rows are deleted by Better Auth itself. Every
 * verification lookup first deletes the rows whose `expiresAt` has passed
 * (unless `verification.disableCleanup` is set, which this app does not), and
 * Q7 is what keeps that delete from scanning the table. Sessions expire the
 * same way on read; `session.expiresAt` needs no index for it.
 *
 * Locking: a session insert now takes a `FOR KEY SHARE` lock on its `user`
 * row, so it waits while another transaction holds that row `FOR UPDATE` —
 * as `PersonalWorkspaceRepository.provision` does for the moment it takes to
 * create the workspace. `member` and `user_role` inserts already did.
 *
 * Renames: whatever primary key and `email` / `token` unique constraints the
 * tables have are found by type and renamed `PK_user`, `UQ_user_email`,
 * `PK_session`, `UQ_session_token`, `PK_account`, `PK_verification`.
 * `down()` gives them back TypeORM's default names. Catalog-only.
 *
 * `down()` removes every key, unique and index this adds and restores the
 * names. It cannot bring back the orphaned or duplicate rows `up()` deleted.
 *
 * ---------------------------------------------------------------------------
 * Large databases (a table over 100k rows or 128 MB): run the ops script.
 *
 * Boot migrations share one transaction and hold every lock until it commits.
 * Building an index or validating a foreign key on a busy `session` inside it
 * would block sign-ins for the whole deploy. So on a large table this migration
 * only checks that the slow work is done, and fails with a pointer here if it is
 * not. Before deploying, run with psql in autocommit mode
 * `apps/api/db/ops/1790000000000-harden-auth-tables.sql`; before reverting,
 * `apps/api/db/ops/1790000000000-harden-auth-tables.rollback.sql`. Both can be
 * re-run. On small databases (development, CI, fresh installs) the migration
 * does all of it itself.
 * ---------------------------------------------------------------------------
 */

const OPS = 'apps/api/db/ops/1790000000000-harden-auth-tables.sql';
const ROLLBACK = 'apps/api/db/ops/1790000000000-harden-auth-tables.rollback.sql';

/** [table, readable name, TypeORM's default name, unique column (none for the primary key)] */
const RENAMES: [string, string, string, string?][] = [
  ['user', 'PK_user', 'PK_cace4a159ff9f2512dd42373760'],
  ['user', 'UQ_user_email', 'UQ_e12875dfb3b1d92d7d7c5377e22', 'email'],
  ['session', 'PK_session', 'PK_f55da76ac1c3ac420f444d2ff11'],
  ['session', 'UQ_session_token', 'UQ_232f8e85d7633bd6ddfad421696', 'token'],
  ['account', 'PK_account', 'PK_54115ee388cdb6d86bb4bf5b2ea'],
  ['verification', 'PK_verification', 'PK_f7e3a90ca384e71d6e2e93bb340'],
];

/** [table, name, definition] */
const INDEXES: [string, string, string][] = [
  // Q2
  ['session', 'IDX_session_userId', `("userId")`],
  // Q3
  [
    'session',
    'IDX_session_impersonatedBy',
    `("impersonatedBy") WHERE "impersonatedBy" IS NOT NULL`,
  ],
  [
    'session',
    'IDX_session_activeOrganizationId',
    `("activeOrganizationId") WHERE "activeOrganizationId" IS NOT NULL`,
  ],
  ['session', 'IDX_session_activeTeamId', `("activeTeamId") WHERE "activeTeamId" IS NOT NULL`],
  // Q4
  ['account', 'IDX_account_userId', `("userId")`],
  // Q6
  ['verification', 'IDX_verification_identifier_createdAt', `("identifier", "createdAt")`],
  // Q7
  ['verification', 'IDX_verification_expiresAt', `("expiresAt")`],
  // Q8
  ['invitation', 'IDX_invitation_inviterId', `("inviterId")`],
  ['invitation', 'IDX_invitation_teamId', `("teamId") WHERE "teamId" IS NOT NULL`],
];

/** Tables whose size decides between doing the work here and asking for the ops script. */
const TABLES = ['session', 'account', 'verification', 'invitation'];

/** [table, name, column, referenced table, ON DELETE] */
const FOREIGN_KEYS: [string, string, string, string, 'CASCADE' | 'SET NULL'][] = [
  ['session', 'FK_session_user', 'userId', 'user', 'CASCADE'],
  ['session', 'FK_session_impersonatedBy', 'impersonatedBy', 'user', 'CASCADE'],
  ['session', 'FK_session_activeOrganization', 'activeOrganizationId', 'organization', 'SET NULL'],
  ['session', 'FK_session_activeTeam', 'activeTeamId', 'team', 'SET NULL'],
  ['account', 'FK_account_user', 'userId', 'user', 'CASCADE'],
];

export class HardenAuthTables1790000000000 implements MigrationInterface {
  name = 'HardenAuthTables1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    for (const [table, readable, , column] of RENAMES) {
      await this.renameConstraint(queryRunner, table, column, readable);
    }
    for (const [table, name, definition] of INDEXES) {
      await this.ensureIndex(queryRunner, table, name, definition);
    }
    await this.ensureProviderAccountUnique(queryRunner);
    for (const foreignKey of FOREIGN_KEYS) {
      await this.ensureForeignKey(queryRunner, ...foreignKey);
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '5s'`);
    // Dropping an index takes an ACCESS EXCLUSIVE lock, held here until the
    // boot transaction commits. On a large table that is the rollback script's job.
    for (const table of TABLES) {
      const [{ count }] = await queryRunner.query(
        `SELECT count(*)::int AS count FROM pg_class c
          WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1)
            AND EXISTS (SELECT 1 FROM pg_index i WHERE i.indexrelid = c.oid AND i.indrelid = $2::regclass)`,
        [[...INDEXES.map(([, name]) => name), 'UQ_account_providerId_accountId'], `"${table}"`],
      );
      if (count > 0 && (await this.isLarge(queryRunner, table))) {
        throw new Error(
          `"${table}" is too large to drop its indexes at boot. Run ${ROLLBACK} first, then revert again.`,
        );
      }
    }
    for (const [table, name] of [...FOREIGN_KEYS].reverse()) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT IF EXISTS "${name}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "account" DROP CONSTRAINT IF EXISTS "UQ_account_providerId_accountId"`,
    );
    for (const [, name] of [...INDEXES].reverse()) {
      await queryRunner.query(`DROP INDEX IF EXISTS "${name}"`);
    }
    for (const [table, , original, column] of [...RENAMES].reverse()) {
      await this.renameConstraint(queryRunner, table, column, original);
    }
    await queryRunner.query(`RESET lock_timeout`);
  }

  /**
   * Renames the table's primary key (no column given) or its single-column
   * unique constraint on `column`, whatever it is called now.
   */
  private async renameConstraint(
    queryRunner: QueryRunner,
    table: string,
    column: string | undefined,
    to: string,
  ) {
    const [row] = await queryRunner.query(
      `SELECT c.conname AS name FROM pg_constraint c
        WHERE c.conrelid = $1::regclass
          AND c.contype = $2
          AND ($3::text IS NULL OR c.conkey = ARRAY[(
                SELECT a.attnum FROM pg_attribute a
                 WHERE a.attrelid = c.conrelid AND a.attname = $3)])`,
      [`"${table}"`, column ? 'u' : 'p', column ?? null],
    );
    if (!row) {
      throw new Error(
        `"${table}" has no ${column ? `unique constraint on "${column}"` : 'primary key'} to rename to ${to}.`,
      );
    }
    if (row.name !== to) {
      await queryRunner.query(`ALTER TABLE "${table}" RENAME CONSTRAINT "${row.name}" TO "${to}"`);
    }
  }

  /** True when a table is too big to build an index or scan it inside the boot transaction. */
  private async isLarge(queryRunner: QueryRunner, table: string): Promise<boolean> {
    const [row] = await queryRunner.query(
      `SELECT c.reltuples > 100000 OR pg_total_relation_size(c.oid) > 128 * 1024 * 1024 AS large
         FROM pg_class c WHERE c.oid = $1::regclass`,
      [`"${table}"`],
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

  private async refuseIfLarge(queryRunner: QueryRunner, table: string, what: string) {
    if (await this.isLarge(queryRunner, table)) {
      throw new Error(
        `${what} and "${table}" is too large to do it at boot. Run ${OPS} first (see this migration's header).`,
      );
    }
  }

  private async ensureIndex(
    queryRunner: QueryRunner,
    table: string,
    name: string,
    definition: string,
  ) {
    const state = await this.indexState(queryRunner, name);
    if (state === 'valid') return;
    await this.refuseIfLarge(queryRunner, table, `${name} is ${state}`);
    if (state === 'invalid') await queryRunner.query(`DROP INDEX "${name}"`);
    await queryRunner.query(`CREATE INDEX "${name}" ON "${table}" ${definition}`);
  }

  private async ensureProviderAccountUnique(queryRunner: QueryRunner) {
    const name = 'UQ_account_providerId_accountId';
    const [constraint] = await queryRunner.query(
      `SELECT 1 FROM pg_constraint WHERE conrelid = '"account"'::regclass AND conname = $1`,
      [name],
    );
    if (constraint) return;
    await this.refuseIfLarge(queryRunner, 'account', `${name} is missing`);
    // TypeORM returns [rows, affected] for a DELETE.
    const [, deleted] = await queryRunner.query(
      `DELETE FROM "account" a
        USING "account" newer
        WHERE newer."providerId" = a."providerId" AND newer."accountId" = a."accountId"
          AND (newer."updatedAt", newer."id") > (a."updatedAt", a."id")`,
    );
    if (deleted > 0) console.log(`HardenAuthTables: deleted ${deleted} duplicate account rows`);
    if ((await this.indexState(queryRunner, name)) !== 'missing') {
      await queryRunner.query(`DROP INDEX "${name}"`);
    }
    await queryRunner.query(
      `ALTER TABLE "account" ADD CONSTRAINT "${name}" UNIQUE ("providerId", "accountId")`,
    );
  }

  private async ensureForeignKey(
    queryRunner: QueryRunner,
    table: string,
    name: string,
    column: string,
    references: string,
    onDelete: 'CASCADE' | 'SET NULL',
  ) {
    const [existing] = await queryRunner.query(
      `SELECT convalidated FROM pg_constraint WHERE conrelid = $1::regclass AND conname = $2`,
      [`"${table}"`, name],
    );
    if (existing?.convalidated) return;
    await this.refuseIfLarge(
      queryRunner,
      table,
      `${name} is ${existing ? 'not validated' : 'missing'}`,
    );
    if (!existing) {
      // NOT VALID first: from here on no new orphan can be written.
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${name}"
           FOREIGN KEY ("${column}") REFERENCES "${references}"("id") ON DELETE ${onDelete} NOT VALID`,
      );
    }
    // Rows pointing at a row that was deleted directly get what ON DELETE
    // would have done to them.
    const orphaned = `t."${column}" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "${references}" r WHERE r."id" = t."${column}")`;
    await queryRunner.query(
      onDelete === 'CASCADE'
        ? `DELETE FROM "${table}" t WHERE ${orphaned}`
        : `UPDATE "${table}" t SET "${column}" = NULL WHERE ${orphaned}`,
    );
    await queryRunner.query(`ALTER TABLE "${table}" VALIDATE CONSTRAINT "${name}"`);
  }
}
