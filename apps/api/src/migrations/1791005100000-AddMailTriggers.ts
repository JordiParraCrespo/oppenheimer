import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Waking on new mail (`product/next-steps/mail.md` §5): Gmail becomes a
 * trigger source. A routine's mail trigger watches one connected account
 * (subject kind `gmail_connection`), and the new mail our poll finds arrives
 * through the inbound-events hub like GitHub's deliveries, deduplicated there
 * per account and message.
 *
 * `gmail_connection."historyId"` is where the poll last read the mailbox's
 * history; null until a routine first watches the account, when it starts
 * from now rather than from the account's past.
 */
export class AddMailTriggers1791005100000 implements MigrationInterface {
  name = 'AddMailTriggers1791005100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.recheck(queryRunner, {
      automation_trigger: [
        'CHK_automation_trigger_source',
        `source IN ('schedule', 'github', 'gmail')`,
      ],
      automation_trigger_subject: [
        'CHK_automation_trigger_subject_kind',
        `"subjectKind" IN ('repository', 'gmail_connection')`,
      ],
      inbound_delivery: ['CHK_inbound_delivery_source', `source IN ('github', 'gmail')`],
      inbound_event: ['CHK_inbound_event_source', `source IN ('github', 'gmail')`],
    });
    await queryRunner.query(
      `ALTER TABLE gmail_connection ADD COLUMN "historyId" character varying(32)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE gmail_connection DROP COLUMN "historyId"`);
    await queryRunner.query(`DELETE FROM inbound_event WHERE source = 'gmail'`);
    await queryRunner.query(`DELETE FROM inbound_delivery WHERE source = 'gmail'`);
    await queryRunner.query(`DELETE FROM automation_trigger WHERE source = 'gmail'`);
    await this.recheck(queryRunner, {
      automation_trigger: ['CHK_automation_trigger_source', `source IN ('schedule', 'github')`],
      automation_trigger_subject: [
        'CHK_automation_trigger_subject_kind',
        `"subjectKind" = 'repository'`,
      ],
      inbound_delivery: ['CHK_inbound_delivery_source', `source = 'github'`],
      inbound_event: ['CHK_inbound_event_source', `source = 'github'`],
    });
  }

  private async recheck(
    queryRunner: QueryRunner,
    checks: Record<string, [name: string, condition: string]>,
  ): Promise<void> {
    for (const [table, [name, condition]] of Object.entries(checks)) {
      await queryRunner.query(`ALTER TABLE ${table} DROP CONSTRAINT "${name}"`);
      await queryRunner.query(`ALTER TABLE ${table} ADD CONSTRAINT "${name}" CHECK (${condition})`);
    }
  }
}
