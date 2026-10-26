import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Inbox reads a workspace's pending approvals across its bots
 * (`GET /v1/bot-approvals?status=pending`, `product/versions/mvp/28-inbox.md`
 * §4), newest first. `IDX_bot_approval_bot` leads with the bot and cannot
 * serve a read that names none.
 *
 * `("organizationId", "status", "createdAt", "id")` rather than a partial
 * index on pending rows: the route takes any status, and the same index
 * serves each with no `Sort` (scanned backwards, keyset on `id`). Putting
 * `"status"` in an index costs no HOT updates that were not already lost:
 * `UQ_bot_approval_pending`'s predicate names it.
 *
 * Access pattern:
 *   the workspace's approvals in one status, newest first → IDX_bot_approval_org_status
 */
export class AddBotApprovalWorkspaceIndex1791003600000 implements MigrationInterface {
  name = 'AddBotApprovalWorkspaceIndex1791003600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_approval_org_status" ON bot_approval ("organizationId", status, "createdAt", id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bot_approval_org_status"`);
  }
}
