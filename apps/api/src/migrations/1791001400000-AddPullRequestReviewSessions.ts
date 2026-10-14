import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Review sessions (`product/next-steps/0.2-pull-requests.md`, "The screens
 * as built"): a session a person starts from a pull request's Chat tab, in a
 * worktree of its head branch. It is a session like any other, with the
 * origin `review` so the Sessions list leaves it out, and one row here that
 * says which pull request it reviews.
 *
 * `pull_request_review_session` is that link. The session is its key: one
 * session reviews one pull request, and goes with it (the composite key to
 * `work_session` keeps the two in one workspace). The pull request is named
 * the way the rest of the area names one (installation, repository, number),
 * with its title and repository name copied at the start, so the sidebar
 * draws its rows without asking GitHub for every one.
 *
 * Access patterns: the person's review sessions in a workspace, newest first
 * (the For review list), served by `IDX_pull_request_review_session_owner`;
 * a pull request's latest one (its Chat tab) is a filter of that same list,
 * which is a person's handful of rows.
 */
export class AddPullRequestReviewSessions1791001400000 implements MigrationInterface {
  name = 'AddPullRequestReviewSessions1791001400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_origin"`);
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_origin" CHECK (origin IN ('person', 'automation', 'review'))`,
    );
    await queryRunner.query(
      `CREATE TABLE pull_request_review_session (
        "sessionId" uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "installationId" uuid NOT NULL,
        "githubRepoId" bigint NOT NULL,
        number integer NOT NULL,
        repository character varying(200) NOT NULL,
        title character varying(1024) NOT NULL,
        "headRef" character varying(255) NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_pull_request_review_session" PRIMARY KEY ("sessionId"),
        CONSTRAINT "CHK_pull_request_review_session_number" CHECK (number > 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_request_review_session_owner" ON pull_request_review_session USING btree ("organizationId", "userId", "createdAt")`,
    );
    // The composite key to the session: what a session's delete looks up.
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_request_review_session_session" ON pull_request_review_session USING btree ("organizationId", "sessionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_request_review_session_user" ON pull_request_review_session USING btree ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pull_request_review_session_installation" ON pull_request_review_session USING btree ("installationId")`,
    );
    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE pull_request_review_session');
    await queryRunner.query(`UPDATE work_session SET origin = 'person' WHERE origin = 'review'`);
    await queryRunner.query(`ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_origin"`);
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_origin" CHECK (origin IN ('person', 'automation'))`,
    );
  }
}

const FOREIGN_KEYS = [
  `ALTER TABLE pull_request_review_session ADD CONSTRAINT "FK_pull_request_review_session_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE pull_request_review_session ADD CONSTRAINT "FK_pull_request_review_session_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE pull_request_review_session ADD CONSTRAINT "FK_pull_request_review_session_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  `ALTER TABLE pull_request_review_session ADD CONSTRAINT "FK_pull_request_review_session_installation" FOREIGN KEY ("installationId") REFERENCES github_installation(id) ON DELETE CASCADE`,
];
