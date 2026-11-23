import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A routine can run on a webhook: a URL any outside system posts to.
 *
 * - `automation_trigger.source` takes `webhook`. The trigger carries nothing
 *   (`config` is `{}`) and watches no subject: what fires it is its routine's
 *   URL.
 * - `automation_webhook` is that URL, one row per routine, kept apart from
 *   the trigger because an edit rewrites a routine's triggers with new ids and
 *   must not change the URL. Only the token's SHA-256 is stored: the token is
 *   shown once, when it is issued. The lookup is by `"tokenHash"`, before any
 *   workspace is known, so its unique is global. The optional signing secret
 *   is sealed under `BOTS_PROVIDER_KEY`, since checking an HMAC needs it whole.
 *   It goes with its routine (`ON DELETE CASCADE`).
 * - `automation_run."webhookPayload"` is what was posted, kept with the run
 *   (capped, `WEBHOOK_BODY_KEPT_CHARS`), so the endpoint can answer with the
 *   run's id at once and the run reads it at dispatch without the hub. A run
 *   has an inbound event or a webhook payload, never both.
 */
export class AddRoutineWebhooks1795192959544 implements MigrationInterface {
  name = 'AddRoutineWebhooks1795192959544';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE automation_trigger DROP CONSTRAINT "CHK_automation_trigger_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_trigger ADD CONSTRAINT "CHK_automation_trigger_source" CHECK (source IN ('schedule', 'github', 'gmail', 'webhook'))`,
    );
    await queryRunner.query(
      `CREATE TABLE automation_webhook (
        "organizationId" uuid NOT NULL,
        "automationId" uuid NOT NULL,
        "tokenHash" character(64) NOT NULL,
        "tokenPrefix" character varying(16) NOT NULL,
        "signingSecretSealed" bytea,
        "lastReceivedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_automation_webhook" PRIMARY KEY ("organizationId", "automationId"),
        CONSTRAINT "UQ_automation_webhook_token_hash" UNIQUE ("tokenHash"),
        CONSTRAINT "FK_automation_webhook_automation" FOREIGN KEY ("organizationId", "automationId") REFERENCES automation("organizationId", id) ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(`ALTER TABLE automation_run ADD COLUMN "webhookPayload" jsonb`);
    await queryRunner.query(
      `ALTER TABLE automation_run ADD CONSTRAINT "CHK_automation_run_webhook_payload" CHECK ("webhookPayload" IS NULL OR (jsonb_typeof("webhookPayload") = 'object' AND "inboundEventId" IS NULL))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE automation_run DROP CONSTRAINT "CHK_automation_run_webhook_payload"`,
    );
    await queryRunner.query(`ALTER TABLE automation_run DROP COLUMN "webhookPayload"`);
    await queryRunner.query(`DROP TABLE automation_webhook`);
    await queryRunner.query(`DELETE FROM automation_trigger WHERE source = 'webhook'`);
    await queryRunner.query(
      `ALTER TABLE automation_trigger DROP CONSTRAINT "CHK_automation_trigger_source"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_trigger ADD CONSTRAINT "CHK_automation_trigger_source" CHECK (source IN ('schedule', 'github', 'gmail'))`,
    );
  }
}
