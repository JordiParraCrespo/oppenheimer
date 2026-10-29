import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a failing check on a pull request came to, as a record
 * (`product/next-steps/0.2-pull-requests.md`, "CI findings"; from Grok Bot's
 * CI investigation, `research/lessons-from-grok-bot.md` §9 row 14).
 *
 * A pull request has no row: it is GitHub's, named by its repository's id and
 * its number. A finding is about one check on one head commit, so a push
 * leaves the findings of the commit before it behind, and a second look at
 * the same check on the same commit replaces the first
 * (`UQ_pull_request_ci_finding`).
 *
 * - The workspace owns the row and its deletion takes it.
 * - Who recorded it is kept as long as they are: the person the call ran as,
 *   and the bot that made the call when a bot did.
 *
 * Access patterns:
 * - a pull request's briefing: its head's findings, by the unique key's
 *   prefix `("organizationId", "githubRepoId", number, "headSha")`;
 * - the two foreign keys to the recorder, by their own partial indexes.
 */
export class AddCiFindings1791005200000 implements MigrationInterface {
  name = 'AddCiFindings1791005200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE pull_request_ci_finding (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "githubRepoId" bigint NOT NULL,
        number integer NOT NULL,
        "headSha" varchar(64) NOT NULL,
        "check" varchar(200) NOT NULL,
        "rootCause" varchar(1000) NOT NULL,
        relation varchar(16) NOT NULL,
        flake varchar(8) NOT NULL,
        action varchar(16) NOT NULL,
        next varchar(500) NOT NULL,
        confidence varchar(8) NOT NULL,
        evidence jsonb NOT NULL DEFAULT '[]',
        "recordedByUserId" uuid,
        "recordedByBotId" uuid,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pull_request_ci_finding" PRIMARY KEY (id),
        CONSTRAINT "UQ_pull_request_ci_finding" UNIQUE ("organizationId", "githubRepoId", number, "headSha", "check"),
        CONSTRAINT "CHK_pull_request_ci_finding_number" CHECK (number > 0),
        CONSTRAINT "CHK_pull_request_ci_finding_text" CHECK (char_length("check") > 0 AND char_length("rootCause") > 0 AND char_length("headSha") > 0),
        CONSTRAINT "CHK_pull_request_ci_finding_relation" CHECK (relation IN ('this_change', 'unrelated', 'unclear')),
        CONSTRAINT "CHK_pull_request_ci_finding_flake" CHECK (flake IN ('flake', 'real', 'unsure')),
        CONSTRAINT "CHK_pull_request_ci_finding_action" CHECK (action IN ('fix_here', 'rerun', 'fix_elsewhere', 'ask')),
        CONSTRAINT "CHK_pull_request_ci_finding_confidence" CHECK (confidence IN ('high', 'medium', 'low')),
        CONSTRAINT "CHK_pull_request_ci_finding_evidence" CHECK (jsonb_typeof(evidence) = 'array')
      )
    `);
    await queryRunner.query(
      `ALTER TABLE pull_request_ci_finding ADD CONSTRAINT "FK_pull_request_ci_finding_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE pull_request_ci_finding ADD CONSTRAINT "FK_pull_request_ci_finding_user" FOREIGN KEY ("recordedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE pull_request_ci_finding ADD CONSTRAINT "FK_pull_request_ci_finding_bot" FOREIGN KEY ("organizationId", "recordedByBotId") REFERENCES bot("organizationId", id) ON DELETE SET NULL ("recordedByBotId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_request_ci_finding_user" ON pull_request_ci_finding ("recordedByUserId") WHERE "recordedByUserId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_request_ci_finding_bot" ON pull_request_ci_finding ("organizationId", "recordedByBotId") WHERE "recordedByBotId" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE pull_request_ci_finding`);
  }
}
