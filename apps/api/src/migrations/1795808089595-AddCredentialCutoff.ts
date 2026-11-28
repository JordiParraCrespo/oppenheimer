import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A password reset takes back every credential the account issued before it
 * (security review, items D and G). Revoking the API tokens through the outbox
 * left a window of seconds in which a token holding `tokens:write` could mint
 * one that survived, so the revocation no longer depends on timing:
 *
 * - `credential_cutoff` holds, per account, the moment of its last reset. The
 *   reset writes it in its own transaction (`OAuthGrantRepository`), and every
 *   scoped credential whose chain began before it is refused on its next
 *   request (`CredentialScopeResolver`, `predatesCutoff`). One row per user,
 *   so the user's id is the key; it goes with the account (`CASCADE`). The
 *   kernel owns it: no other module writes it, and `user` is Better Auth's.
 * - `api_token."issuedAt"` is when that chain began: the mint time for a token
 *   minted from a browser session (that session's creation), and the minting
 *   token's own `issuedAt` for one minted with a token. A token minted by a
 *   pre-reset token in a request that raced the reset is refused with it.
 *   Rows already stored began when they were minted, so the backfill is
 *   `"createdAt"`; the column then defaults to `now()` like it.
 */
export class AddCredentialCutoff1795808089595 implements MigrationInterface {
  name = 'AddCredentialCutoff1795808089595';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "credential_cutoff" (
        "userId" uuid NOT NULL,
        "issuedBefore" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_credential_cutoff" PRIMARY KEY ("userId"),
        CONSTRAINT "FK_credential_cutoff_user" FOREIGN KEY ("userId")
          REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "api_token" ADD COLUMN IF NOT EXISTS "issuedAt" timestamptz`,
    );
    await queryRunner.query(
      `UPDATE "api_token" SET "issuedAt" = "createdAt" WHERE "issuedAt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_token" ALTER COLUMN "issuedAt" SET DEFAULT now(), ALTER COLUMN "issuedAt" SET NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_token" DROP COLUMN IF EXISTS "issuedAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "credential_cutoff"`);
  }
}
