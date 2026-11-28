import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A paired host and a routine's webhook URL are issued without a verified
 * email where the deployment delivers none (`mayIssueCredential`), and
 * delivery can be switched on later. Someone who registered `victim@corp.com`
 * first could pair a machine then and keep it through the real owner's
 * password reset. So each records whether its owner's address was verified
 * when it was issued, and a reset takes back the ones that were not
 * (`PasswordResetDomainEvent`), leaving a verified owner's machines alone:
 *
 * - `host_pairing_token."issuedVerified"`: at the mint, the one step a person
 *   takes behind `CREDENTIAL_ISSUANCE`. Registration is the machine's, signed
 *   by the token alone, and the account may have changed hands since the mint.
 * - `host."issuedVerified"`: copied from the token its registration spent.
 * - `automation_webhook."issuedVerified"`: at the URL's issue; a re-issue
 *   records it again.
 *
 * Booleans with a constant default, so the columns are added without a
 * rewrite. The default is `false`: a row that does not say is one a reset
 * takes back. Existing rows predate the rule, so nothing recorded what held at
 * their issue; the backfill is the owner's address as it is now. A squatter
 * cannot have verified someone else's address, so this keeps only what a
 * verified owner holds.
 */
export class RecordCredentialIssuedVerified1795811854638 implements MigrationInterface {
  name = 'RecordCredentialIssuedVerified1795811854638';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['host_pairing_token', 'host', 'automation_webhook']) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "issuedVerified" boolean NOT NULL DEFAULT false`,
      );
    }
    await queryRunner.query(`
      UPDATE "host_pairing_token" t SET "issuedVerified" = true
        FROM "user" u
       WHERE u."id" = t."ownerUserId" AND u."emailVerified" = true AND t."issuedVerified" = false
    `);
    await queryRunner.query(`
      UPDATE "host" h SET "issuedVerified" = true
        FROM "user" u
       WHERE u."id" = h."ownerUserId" AND u."emailVerified" = true AND h."issuedVerified" = false
    `);
    await queryRunner.query(`
      UPDATE "automation_webhook" w SET "issuedVerified" = true
        FROM "member" m
        JOIN "user" u ON u."id" = m."userId"
       WHERE m."organizationId" = w."organizationId" AND m."role" = 'owner'
         AND u."emailVerified" = true AND w."issuedVerified" = false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['automation_webhook', 'host', 'host_pairing_token']) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "issuedVerified"`);
    }
  }
}
