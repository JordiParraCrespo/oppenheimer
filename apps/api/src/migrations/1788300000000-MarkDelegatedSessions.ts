import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tells device sessions apart from the internal ones minted for a credential.
 *
 * `DelegatedSessionAdapter` mints a Better Auth session so an API token or an
 * OAuth client can reach the façades that resolve their caller through Better
 * Auth. Those rows landed in the same table as real sign-ins, and the profile
 * and security "Active sessions" screens — which list every unexpired row as a
 * device with a Sign out button — showed one production account 23 devices
 * where two people had actually signed in.
 *
 * `delegated` is the fact those screens now filter on. It is persisted rather
 * than inferred from the `userAgent` prefix the rows also carry: a user agent
 * is a label the client chooses, so a browser that sent `oppenheimer-api-token/...`
 * could otherwise hide itself from the screen whose whole job is to expose it.
 *
 * `delegatedCredentialId` names the credential a row was minted for, so a
 * remint can delete the row it supersedes.
 *
 * Existing delegated rows are *marked*, not deleted: a credential may still be
 * presenting one from the delegated-session cache, and deleting it would fail
 * its façade calls until that entry expired. Marking takes them off the screen
 * immediately, and they are gone within the day their (wrongly persisted)
 * expiry gives them. Already-expired ones authenticate nobody, so those go.
 */
export class MarkDelegatedSessions1788300000000 implements MigrationInterface {
  name = 'MarkDelegatedSessions1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "delegated" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD COLUMN IF NOT EXISTS "delegatedCredentialId" character varying`,
    );
    // The label `DelegatedSessionAdapter` has always written: `oppenheimer-<kind>/<credential>`.
    await queryRunner.query(
      `UPDATE "session"
          SET "delegated" = true
        WHERE "delegated" = false
          AND ("userAgent" LIKE 'oppenheimer-api-token/%' OR "userAgent" LIKE 'oppenheimer-oauth/%')`,
    );
    await queryRunner.query(
      `DELETE FROM "session" WHERE "delegated" = true AND "expiresAt" <= now()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN IF EXISTS "delegatedCredentialId"`);
    await queryRunner.query(`ALTER TABLE "session" DROP COLUMN IF EXISTS "delegated"`);
  }
}
