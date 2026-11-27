import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `oauthApplication."redirectURLs"` becomes `"redirectUrls"`, the name Better
 * Auth 1.6's MCP and OIDC provider plugins write and read (their schema's
 * `redirectUrls` field, with no rename hook in the MCP plugin). With the old
 * name every dynamic client registration (`POST /api/auth/mcp/register`)
 * failed with a 500, so no MCP client could connect. Found while testing that
 * an OAuth grant needs a verified email (security review, item C).
 *
 * Better Auth owns the table and its names (`database-design.md`), so this
 * follows Better Auth rather than the other way round. A rename is a catalog
 * change; `oauthApplication` holds one row per registered client.
 */
export class RenameOAuthApplicationRedirectUrls1795806002835 implements MigrationInterface {
  name = 'RenameOAuthApplicationRedirectUrls1795806002835';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauthApplication" RENAME COLUMN "redirectURLs" TO "redirectUrls"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "oauthApplication" RENAME COLUMN "redirectUrls" TO "redirectURLs"`,
    );
  }
}
