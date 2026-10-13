import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Several Google accounts per person on Plan's calendar
 * (`product/versions/mvp/23-plan-milestones-stats-accounts.md` §5).
 *
 * `calendar_connection` was one row per person per workspace. An account is now
 * keyed by Google's `sub` (`accountSubject`), not by its address: an address can
 * change, the subject cannot. Rows written before this have no subject; they
 * get one when the person reconnects that account (the callback matches it by
 * address) or on a token refresh that returns an ID token. So two partial
 * uniques hold both shapes: one row per `(person, provider, subject)` once the
 * subject is known, and at most one unkeyed row per person — exactly what the
 * old `UQ_calendar_connection_user` allowed. The callback refuses a token
 * response without an ID token, so no new unkeyed row is written; a later
 * migration drops the second index once none is left.
 *
 * `colorIndex` tells a person's accounts apart on the month: the app gives a
 * new connection the lowest index 0–4 none of that person's others holds and
 * never reassigns it, so no unique backs it (the cap of five is the app's too).
 * Existing rows are a person's only one, so the default 0 is already right.
 *
 * Access patterns are unchanged: a person's own rows, by workspace and owner
 * (the uniques lead with both), and an account's erasure by `userId`
 * (`IDX_calendar_connection_user`).
 */
export class AddCalendarAccounts1791000900000 implements MigrationInterface {
  name = 'AddCalendarAccounts1791000900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE calendar_connection ADD COLUMN "accountSubject" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE calendar_connection ADD COLUMN "colorIndex" smallint DEFAULT 0 NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE calendar_connection ADD CONSTRAINT "CHK_calendar_connection_color_index" CHECK ("colorIndex" BETWEEN 0 AND 4)`,
    );
    await queryRunner.query(
      `ALTER TABLE calendar_connection DROP CONSTRAINT "UQ_calendar_connection_user"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_calendar_connection_user_account" ON calendar_connection USING btree ("organizationId", "userId", provider, "accountSubject") WHERE "accountSubject" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_calendar_connection_user_unkeyed" ON calendar_connection USING btree ("organizationId", "userId", provider) WHERE "accountSubject" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_calendar_connection_user_unkeyed"`);
    await queryRunner.query(`DROP INDEX "UQ_calendar_connection_user_account"`);
    // The old shape holds one account per person: keep each person's oldest.
    await queryRunner.query(
      `DELETE FROM calendar_connection c
        USING calendar_connection older
        WHERE older."organizationId" = c."organizationId"
          AND older."userId" = c."userId"
          AND older.provider = c.provider
          AND (older."createdAt", older.id) < (c."createdAt", c.id)`,
    );
    await queryRunner.query(
      `ALTER TABLE calendar_connection ADD CONSTRAINT "UQ_calendar_connection_user" UNIQUE ("organizationId", "userId", provider)`,
    );
    await queryRunner.query(
      `ALTER TABLE calendar_connection DROP CONSTRAINT "CHK_calendar_connection_color_index"`,
    );
    await queryRunner.query(`ALTER TABLE calendar_connection DROP COLUMN "colorIndex"`);
    await queryRunner.query(`ALTER TABLE calendar_connection DROP COLUMN "accountSubject"`);
  }
}
