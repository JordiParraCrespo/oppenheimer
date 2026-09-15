import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds scoped-credential support:
 *
 *   - `api_token` — application-owned personal access tokens. Only a SHA-256
 *     digest of each secret is stored; `scopes`, `organizationIds` and
 *     `ipAllowlist` are jsonb.
 *   - Better Auth **MCP / OIDC provider** tables (`oauthApplication`,
 *     `oauthAccessToken`, `oauthConsent`) backing the OAuth 2.1 flow MCP
 *     clients use, including dynamic client registration and the consent
 *     screen's record of what a user granted.
 *   - Own-token permissions on the seeded `user` role, so every user can mint
 *     and revoke their own tokens without an admin.
 *
 * Better Auth's tables use its camelCase convention (quoted identifiers) so the
 * plugin's own statements line up with the schema.
 */
export class AddApiTokensAndOAuth1781100000000 implements MigrationInterface {
  name = 'AddApiTokensAndOAuth1781100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- api_token ---
    await queryRunner.query(
      `CREATE TABLE "api_token" (
         "id" uuid NOT NULL,
         "userId" uuid NOT NULL,
         "name" character varying(80) NOT NULL,
         "prefix" character varying(32) NOT NULL,
         "tokenHash" character varying(64) NOT NULL,
         "scopes" jsonb NOT NULL DEFAULT '[]',
         "organizationIds" jsonb,
         "ipAllowlist" jsonb,
         "expiresAt" TIMESTAMP,
         "lastUsedAt" TIMESTAMP,
         "revokedAt" TIMESTAMP,
         "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
         "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "PK_api_token_id" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_api_token_tokenHash" ON "api_token" ("tokenHash")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_api_token_userId" ON "api_token" ("userId")`);
    await queryRunner.query(
      `ALTER TABLE "api_token" ADD CONSTRAINT "FK_api_token_user"
         FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`,
    );

    // --- Better Auth MCP / OIDC provider tables ---
    await queryRunner.query(
      `CREATE TABLE "oauthApplication" (
         "id" uuid NOT NULL,
         "name" character varying,
         "icon" text,
         "metadata" text,
         "clientId" character varying NOT NULL,
         "clientSecret" character varying,
         "redirectURLs" text NOT NULL,
         "type" character varying NOT NULL,
         "disabled" boolean NOT NULL DEFAULT false,
         "userId" character varying,
         "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
         "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "UQ_oauthApplication_clientId" UNIQUE ("clientId"),
         CONSTRAINT "PK_oauthApplication_id" PRIMARY KEY ("id")
       )`,
    );

    await queryRunner.query(
      `CREATE TABLE "oauthAccessToken" (
         "id" uuid NOT NULL,
         "accessToken" character varying,
         "refreshToken" character varying,
         "accessTokenExpiresAt" TIMESTAMP,
         "refreshTokenExpiresAt" TIMESTAMP,
         "clientId" character varying NOT NULL,
         "userId" uuid,
         "scopes" text NOT NULL,
         "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
         "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "PK_oauthAccessToken_id" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauthAccessToken_accessToken" ON "oauthAccessToken" ("accessToken")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauthAccessToken_clientId" ON "oauthAccessToken" ("clientId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauthAccessToken_userId" ON "oauthAccessToken" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "oauthAccessToken" ADD CONSTRAINT "FK_oauthAccessToken_user"
         FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE "oauthConsent" (
         "id" uuid NOT NULL,
         "clientId" character varying NOT NULL,
         "userId" uuid NOT NULL,
         "scopes" text NOT NULL,
         "consentGiven" boolean NOT NULL DEFAULT false,
         "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
         "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
         CONSTRAINT "PK_oauthConsent_id" PRIMARY KEY ("id")
       )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_oauthConsent_clientId" ON "oauthConsent" ("clientId")`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_oauthConsent_userId" ON "oauthConsent" ("userId")`);
    await queryRunner.query(
      `ALTER TABLE "oauthConsent" ADD CONSTRAINT "FK_oauthConsent_user"
         FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE`,
    );

    // --- own-token permissions for the seeded `user` role ---
    // Any permissions an admin has already added to the role survive: only the
    // three ApiToken rules are filtered out before being appended, which also
    // makes the statement idempotent. (`jsonb - jsonb` is not an operator —
    // removing an array element by value needs the unnest/re-aggregate form.)
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE NOT (rule->>'subject' = 'ApiToken'
                            AND rule->>'action' IN ('read', 'create', 'delete'))
              )
              || '[{"action":"read","subject":"ApiToken","conditions":{"userId":"\${user.id}"}},
                    {"action":"create","subject":"ApiToken","conditions":{"userId":"\${user.id}"}},
                    {"action":"delete","subject":"ApiToken","conditions":{"userId":"\${user.id}"}}]'::jsonb
        WHERE "name" = 'user'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role"
          SET "permissions" = (
                SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
                  FROM jsonb_array_elements("permissions") AS rule
                 WHERE NOT (rule->>'subject' = 'ApiToken'
                            AND rule->>'action' IN ('read', 'create', 'delete'))
              )
        WHERE "name" = 'user'`,
    );

    await queryRunner.query(`ALTER TABLE "oauthConsent" DROP CONSTRAINT "FK_oauthConsent_user"`);
    await queryRunner.query(`DROP TABLE "oauthConsent"`);

    await queryRunner.query(
      `ALTER TABLE "oauthAccessToken" DROP CONSTRAINT "FK_oauthAccessToken_user"`,
    );
    await queryRunner.query(`DROP TABLE "oauthAccessToken"`);

    await queryRunner.query(`DROP TABLE "oauthApplication"`);

    await queryRunner.query(`ALTER TABLE "api_token" DROP CONSTRAINT "FK_api_token_user"`);
    await queryRunner.query(`DROP TABLE "api_token"`);
  }
}
