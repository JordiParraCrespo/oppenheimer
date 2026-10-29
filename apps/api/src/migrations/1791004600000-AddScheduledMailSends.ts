import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Scheduled sends (`product/next-steps/mail.md` §3.4): a `mail_send` row that
 * waits for its time. `scheduledFor` is when it goes and `plan` the message it
 * goes out as, approved when it was scheduled and cleared once it is sent or
 * fails. A cancelled one is kept as the record of what was stopped.
 *
 * Access patterns:
 * - the sends due now, read once a minute: `IDX_mail_send_due`, partial on
 *   `status = 'scheduled'`, so it holds only what waits;
 * - a person's scheduled sends: `IDX_mail_send_user_created`, already there.
 */
export class AddScheduledMailSends1791004600000 implements MigrationInterface {
  name = 'AddScheduledMailSends1791004600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE mail_send
         ADD COLUMN "scheduledFor" timestamp with time zone,
         ADD COLUMN plan jsonb`,
    );
    await queryRunner.query('ALTER TABLE mail_send DROP CONSTRAINT "CHK_mail_send_status"');
    await queryRunner.query(
      `ALTER TABLE mail_send ADD CONSTRAINT "CHK_mail_send_status"
         CHECK (status IN ('scheduled', 'sending', 'sent', 'failed', 'cancelled'))`,
    );
    await queryRunner.query(
      `ALTER TABLE mail_send ADD CONSTRAINT "CHK_mail_send_scheduled"
         CHECK (status <> 'scheduled' OR ("scheduledFor" IS NOT NULL AND plan IS NOT NULL))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_mail_send_due" ON mail_send ("scheduledFor") WHERE status = 'scheduled'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "IDX_mail_send_due"');
    await queryRunner.query('ALTER TABLE mail_send DROP CONSTRAINT "CHK_mail_send_scheduled"');
    await queryRunner.query('ALTER TABLE mail_send DROP CONSTRAINT "CHK_mail_send_status"');
    await queryRunner.query(`DELETE FROM mail_send WHERE status IN ('scheduled', 'cancelled')`);
    await queryRunner.query(
      `ALTER TABLE mail_send ADD CONSTRAINT "CHK_mail_send_status"
         CHECK (status IN ('sending', 'sent', 'failed'))`,
    );
    await queryRunner.query('ALTER TABLE mail_send DROP COLUMN plan, DROP COLUMN "scheduledFor"');
  }
}
