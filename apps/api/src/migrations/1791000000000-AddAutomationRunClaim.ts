import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A run reserves its slot before it has a session to be counted by.
 *
 * The overlap and capacity guards count live runs, and a run is only countable
 * once its session exists. Dispatch reads those counts and then creates the
 * session, so with the queue running four dispatches at once all four read the
 * same counts and all four passed: measured, ten manual runs of an automation
 * whose overlap policy is `skip` — one live run, by definition — started four
 * sessions. The number was the worker count, not the cap.
 *
 * `claimedAt` is the reservation. It is deliberately *not* another value in
 * `outcome`: a run that has claimed is still `pending`, so the state machine
 * every client reads is unchanged and "dispatched implies a session" keeps
 * holding. The guards count a fresh claim alongside the live sessions, so the
 * dispatch that loses the race sees the winner and waits.
 *
 * It is freshness, not a flag, because the process that claims can die between
 * the claim and the session: a claim older than the dispatch's own timeout is
 * ignored rather than holding a slot forever, so nothing has to clean up after
 * a crash. The partial index is the guards' own lookup — the only rows that
 * matter are the claimed, undispatched ones, which is a handful at any moment.
 */
export class AddAutomationRunClaim1791000000000 implements MigrationInterface {
  name = 'AddAutomationRunClaim1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "automation_run" ADD COLUMN IF NOT EXISTS "claimedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_automation_run_claimed" ON "automation_run" ("claimedAt")
         WHERE "outcome" = 'pending' AND "claimedAt" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_automation_run_claimed"`);
    await queryRunner.query(`ALTER TABLE "automation_run" DROP COLUMN IF EXISTS "claimedAt"`);
  }
}
