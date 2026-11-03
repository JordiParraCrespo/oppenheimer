import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sentry as a trigger source (`product/next-steps/sentry.md`). A workspace
 * connects one Sentry organization through an internal integration; its client
 * secret, sealed under `SENTRY_CONNECTION_KEY`, is what every webhook's
 * signature is checked with. A Sentry trigger watches that connection (subject
 * kind `sentry_connection`), and its webhooks arrive through the
 * inbound-events hub like GitHub's.
 *
 * The connection is deleted, not revoked: nothing refers to its row but the
 * triggers that name it, which then never fire again.
 */
export class AddSentryTriggers1793700000000 implements MigrationInterface {
  name = 'AddSentryTriggers1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE sentry_connection (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "organizationSlug" character varying(64) NOT NULL,
        "sealedClientSecret" bytea NOT NULL,
        "secretHint" character varying(8) NOT NULL,
        "createdByUserId" uuid NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_sentry_connection" PRIMARY KEY (id)
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_sentry_connection_organization" ON sentry_connection USING btree ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sentry_connection_created_by" ON sentry_connection USING btree ("createdByUserId")`,
    );
    await queryRunner.query(
      `ALTER TABLE sentry_connection ADD CONSTRAINT "FK_sentry_connection_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE sentry_connection ADD CONSTRAINT "FK_sentry_connection_created_by" FOREIGN KEY ("createdByUserId") REFERENCES "user"(id) ON DELETE CASCADE`,
    );
    await this.recheck(queryRunner, {
      automation_trigger: [
        'CHK_automation_trigger_source',
        `source IN ('schedule', 'github', 'gmail', 'sentry')`,
      ],
      automation_trigger_subject: [
        'CHK_automation_trigger_subject_kind',
        `"subjectKind" IN ('repository', 'gmail_connection', 'sentry_connection')`,
      ],
      inbound_delivery: ['CHK_inbound_delivery_source', `source IN ('github', 'gmail', 'sentry')`],
      inbound_event: ['CHK_inbound_event_source', `source IN ('github', 'gmail', 'sentry')`],
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM inbound_event WHERE source = 'sentry'`);
    await queryRunner.query(`DELETE FROM inbound_delivery WHERE source = 'sentry'`);
    await queryRunner.query(`DELETE FROM automation_trigger WHERE source = 'sentry'`);
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
    await queryRunner.query(`DROP TABLE sentry_connection`);
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
