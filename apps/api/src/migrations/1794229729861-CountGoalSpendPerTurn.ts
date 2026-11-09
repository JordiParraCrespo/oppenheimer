import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A goal counts each of its turns' spend once, keyed on the turn
 * (`product/versions/mvp/25-bots.md` §4.1). Until now the goal's own row
 * marked a pause whose turn still owed its spend (`updatedAt` = `pausedAt`),
 * and any other write to the goal between the pause and the turn's end (a
 * rate-limit hold, a claim, the owner's Resume, a pause from another turn)
 * moved that mark, so the turn's tokens were never added.
 *
 * - `bot_turn."goalSpendCountedAt"`, null until the turn's tokens are added
 *   to its goal, in the same transaction that adds them; the add is
 *   conditional on it being null, so a job run twice adds nothing more.
 * - No backfill: a turn whose goal decision is still held at deploy (until a
 *   rate limit's reset) is counted when it runs, as it would have been.
 * - No index: the write is by primary key.
 */
export class CountGoalSpendPerTurn1794229729861 implements MigrationInterface {
  name = 'CountGoalSpendPerTurn1794229729861';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_turn" ADD "goalSpendCountedAt" timestamptz`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bot_turn" DROP COLUMN "goalSpendCountedAt"`);
  }
}
