import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A user's workspace preferences.
 *
 * Their own table rather than columns on `user`: they have a different
 * lifecycle — defaults that only materialize when someone first saves — and
 * keeping them off the identity row means a preference write can never touch
 * a column Better Auth owns.
 *
 * No row is backfilled on purpose: `GET /profile/settings` answers with the
 * defaults when none exists, so a pre-existing account and a fresh one look
 * identical to a client, and the first save upserts. `locale` is what a queued
 * email renders in — the one reader that has no request to negotiate from.
 */
export class AddUserSettings1788600000000 implements MigrationInterface {
  name = 'AddUserSettings1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_settings" (
        "userId"         uuid NOT NULL,
        "theme"          character varying NOT NULL DEFAULT 'system',
        "locale"         character varying NOT NULL DEFAULT 'en',
        "density"        character varying NOT NULL DEFAULT 'comfortable',
        "weeklyDigest"   boolean NOT NULL DEFAULT true,
        "productUpdates" boolean NOT NULL DEFAULT false,
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_settings" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_user_settings_user"
          FOREIGN KEY ("userId") REFERENCES "user"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_settings"`);
  }
}
