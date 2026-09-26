import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `work_session.projectSlug`: the directory name the host's paths carry.
 *
 * Every path on a host is derived from the project's slug at the time the
 * session was requested — `projects/<projectSlug>/sessions/<sessionSlug>/` and
 * the branch `oppenheimer/<projectSlug>/<sessionSlug>` — and a session can now
 * move to another project (`session.moved`) without anything on the host
 * moving. So the slug is snapshotted on the row at request and never changes:
 * a restart, a checkout added later and a re-dispatch after a link hello all
 * read it from here rather than from the project the session currently
 * belongs to. A path is never an identity.
 *
 * Backfilled from the project every row belongs to, which is where the value
 * came from until now, then made `NOT NULL`.
 */
export class AddSessionProjectSlug1789800000000 implements MigrationInterface {
  name = 'AddSessionProjectSlug1789800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_session" ADD "projectSlug" character varying`);
    await queryRunner.query(
      `UPDATE "work_session" ws SET "projectSlug" = p."slug"
         FROM "project" p WHERE p."id" = ws."projectId"`,
    );
    await queryRunner.query(`ALTER TABLE "work_session" ALTER COLUMN "projectSlug" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "work_session" DROP COLUMN "projectSlug"`);
  }
}
