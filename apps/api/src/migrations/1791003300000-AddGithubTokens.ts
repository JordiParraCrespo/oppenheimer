import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A person's own GitHub tokens, for the repositories the App will never be
 * installed on (`product/next-steps/0.2-pull-requests.md` §6.2).
 *
 * - `github_token`: one row per token a person added, with the label they
 *   gave it. The secret is sealed with AES-256-GCM under
 *   `GITHUB_USER_TOKEN_KEY` (`bytea`), as `github_user_grant`'s are: a token
 *   is used to call GitHub, so it is sealed rather than digested. What the
 *   token opens is `repositories`, a `jsonb` list: it is read whole (to choose
 *   which key reads a repository, and for the picker), replaced whole when the
 *   token is checked again, and never filtered on in SQL. `refusedAt` is when
 *   GitHub last answered the token `401`; a refused token is not chosen until
 *   a check succeeds again. Gone with the person.
 * - `github_token_pin`: the token a person chose for one repository, over the
 *   narrowest one. Keyed by the person and GitHub's repository id, and tied to
 *   the token by `("userId", "tokenId")`, so a pin can never name somebody
 *   else's token. Gone with the token.
 * - `watched_repository."installationId"` becomes nullable: null is a
 *   repository read through the person's tokens. Which token reads it is
 *   chosen at read time and never stored on the watch, so pinning or removing
 *   a token does not touch it. The unique key becomes `NULLS NOT DISTINCT`,
 *   or two watches of one token repository would both fit.
 *
 * Access patterns and the index that serves each:
 *   Q1 a person's tokens, oldest first (settings, choosing a key) → IDX_github_token_user_created
 *   Q2 a person's token by its label (refusing a second one)     → UQ_github_token_user_label
 *   Q3 a person's pins (choosing a key)                          → PK_github_token_pin
 *   Q4 a token's pins (its delete cascades)                      → IDX_github_token_pin_token
 *
 * Bounded: a person has a handful of tokens and a pin per repository at most.
 */
export class AddGithubTokens1791003300000 implements MigrationInterface {
  name = 'AddGithubTokens1791003300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "github_token" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId"        uuid NOT NULL,
        "label"         character varying(80) NOT NULL,
        "kind"          character varying(16) NOT NULL,
        "githubUserId"  bigint NOT NULL,
        "login"         character varying(100) NOT NULL,
        "tokenSealed"   bytea NOT NULL,
        "scopes"        character varying(500),
        "expiresAt"     TIMESTAMP WITH TIME ZONE,
        "repositories"  jsonb NOT NULL DEFAULT '[]',
        "checkedAt"     TIMESTAMP WITH TIME ZONE NOT NULL,
        "refusedAt"     TIMESTAMP WITH TIME ZONE,
        "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_github_token" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_github_token_user_label" UNIQUE ("userId", "label"),
        CONSTRAINT "UQ_github_token_user_id" UNIQUE ("userId", "id"),
        CONSTRAINT "CHK_github_token_label" CHECK (char_length("label") > 0),
        CONSTRAINT "CHK_github_token_kind" CHECK ("kind" IN ('fine_grained', 'classic', 'other')),
        CONSTRAINT "CHK_github_token_repositories" CHECK (jsonb_typeof("repositories") = 'array'),
        CONSTRAINT "FK_github_token_user"
          FOREIGN KEY ("userId") REFERENCES "user"("id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    // Q1: a person's tokens, oldest first; also backs FK_github_token_user.
    await queryRunner.query(
      `CREATE INDEX "IDX_github_token_user_created" ON "github_token" ("userId", "createdAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE "github_token_pin" (
        "userId"        uuid NOT NULL,
        "githubRepoId"  bigint NOT NULL,
        "tokenId"       uuid NOT NULL,
        "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_github_token_pin" PRIMARY KEY ("userId", "githubRepoId"),
        CONSTRAINT "FK_github_token_pin_token"
          FOREIGN KEY ("userId", "tokenId") REFERENCES "github_token"("userId", "id")
          ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    // Q4: a token's pins, which its delete cascades to.
    await queryRunner.query(
      `CREATE INDEX "IDX_github_token_pin_token" ON "github_token_pin" ("userId", "tokenId")`,
    );

    await queryRunner.query(
      `ALTER TABLE "watched_repository" ALTER COLUMN "installationId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "watched_repository" DROP CONSTRAINT "UQ_watched_repository"`,
    );
    await queryRunner.query(
      `ALTER TABLE "watched_repository" ADD CONSTRAINT "UQ_watched_repository"
         UNIQUE NULLS NOT DISTINCT ("organizationId", "userId", "installationId", "githubRepoId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "watched_repository" WHERE "installationId" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "watched_repository" DROP CONSTRAINT "UQ_watched_repository"`,
    );
    await queryRunner.query(
      `ALTER TABLE "watched_repository" ADD CONSTRAINT "UQ_watched_repository"
         UNIQUE ("organizationId", "userId", "installationId", "githubRepoId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "watched_repository" ALTER COLUMN "installationId" SET NOT NULL`,
    );
    await queryRunner.query(`DROP INDEX "IDX_github_token_pin_token"`);
    await queryRunner.query(`DROP TABLE "github_token_pin"`);
    await queryRunner.query(`DROP INDEX "IDX_github_token_user_created"`);
    await queryRunner.query(`DROP TABLE "github_token"`);
  }
}
