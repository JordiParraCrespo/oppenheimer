import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Watching a repository is opt-in (`product/next-steps/0.2-pull-requests.md`,
 * question 1): a `watched_repository` row is a watch and no row is not. The
 * `watching` boolean recorded the opt-out era's exceptions, so its `false`
 * rows are deleted (they now say what absence says) and the column goes.
 * Repositories that were watched only by default are not given rows: nothing
 * is watched until its person picks it. `updatedAt` becomes `createdAt`, when
 * the watch began, since a watch is never edited.
 */
export class WatchedRepositoryIsAWatch1791000500000 implements MigrationInterface {
  name = 'WatchedRepositoryIsAWatch1791000500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM watched_repository WHERE NOT watching');
    await queryRunner.query('ALTER TABLE watched_repository DROP COLUMN watching');
    await queryRunner.query(
      'ALTER TABLE watched_repository RENAME COLUMN "updatedAt" TO "createdAt"',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE watched_repository RENAME COLUMN "createdAt" TO "updatedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE watched_repository ADD COLUMN watching boolean NOT NULL DEFAULT true',
    );
    await queryRunner.query('ALTER TABLE watched_repository ALTER COLUMN watching DROP DEFAULT');
  }
}
