import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots that create bots (`product/versions/mvp/25-bots.md` §4.6,
 * `create_bot`): the new bot is the person's (`createdByUserId` is the
 * owner the tool acts as), marked "created by" the bot that made it.
 *
 * - `bot."createdByBotId"`: the bot that created it; null for a bot made in
 *   the console, or once its creator is deleted. Composite on
 *   `("organizationId", …)` like every other bot reference, so a bot can only
 *   be marked by a bot of its own workspace, and deleting the creator only
 *   loses the link (`ON DELETE SET NULL ("createdByBotId")`, Postgres 15+, so
 *   the workspace column stays): the bot it made is still the person's.
 * - `bot."idempotencyKey"`: what makes a creation happen once. A tool call
 *   carries one (`bot:approval:<id>` for an approved call, the turn and a
 *   digest of the input otherwise), so an approved call's job retried after a
 *   crash, or the model repeating itself in one turn, finds the bot the first
 *   attempt made instead of making a second. Unique per workspace among the
 *   rows that have one (`UQ_bot_organization_idempotency`, partial), the same
 *   shape as `work_session`'s; the console's creations carry none.
 *
 * Access patterns and the index that serves each:
 * - the bot an idempotency key already made (read back after a conflict):
 *   `UQ_bot_organization_idempotency`;
 * - a creator's deletion nulling `createdByBotId` (the FK's referencing
 *   side): `IDX_bot_created_by_bot`, partial on the rows that have one.
 */
export class AddBotCreatedByBot1791002300000 implements MigrationInterface {
  name = 'AddBotCreatedByBot1791002300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot ADD COLUMN "createdByBotId" uuid`);
    await queryRunner.query(`ALTER TABLE bot ADD COLUMN "idempotencyKey" character varying(128)`);
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_created_by_bot" ON bot USING btree ("organizationId", "createdByBotId") WHERE ("createdByBotId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_organization_idempotency" ON bot USING btree ("organizationId", "idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot ADD CONSTRAINT "FK_bot_created_by_bot" FOREIGN KEY ("organizationId", "createdByBotId") REFERENCES bot("organizationId", id) ON DELETE SET NULL ("createdByBotId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot DROP CONSTRAINT "FK_bot_created_by_bot"`);
    await queryRunner.query(`DROP INDEX "UQ_bot_organization_idempotency"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_created_by_bot"`);
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "idempotencyKey"`);
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "createdByBotId"`);
  }
}
