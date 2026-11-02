import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Mail sends (`product/next-steps/mail.md` §3.4): `mail_send`, one row per
 * message a bot sent from a person's Gmail.
 *
 * A row is claimed before Gmail is asked, under the approval it carries out,
 * so a retried job finds it and never sends twice; then it records what went
 * out: from which account, to whom, the subject, Gmail's message and thread
 * ids. The body is never kept: Gmail's Sent folder has it.
 *
 * Access patterns:
 * - the send an approval carried out: `UQ_mail_send_approval`;
 * - an account's sends in the last day, for the daily cap:
 *   `IDX_mail_send_connection_created`, whose leading column backs the
 *   foreign key to the connection;
 * - a person's sends, newest first: `IDX_mail_send_user_created`, whose
 *   leading column backs the foreign key to the workspace;
 * - the foreign keys to the person and the bot: `IDX_mail_send_user`,
 *   `IDX_mail_send_bot`.
 *
 * It goes with the workspace and the person. A disconnected account or a
 * deleted bot leaves the record, unattributed.
 */
export class AddMailSends1791004500000 implements MigrationInterface {
  name = 'AddMailSends1791004500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE mail_send (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "connectionId" uuid,
        "botId" uuid,
        "approvalId" uuid NOT NULL,
        kind character varying(16) NOT NULL,
        "accountEmail" character varying(320) NOT NULL,
        recipients text[] DEFAULT '{}'::text[] NOT NULL,
        subject character varying(998) NOT NULL,
        status character varying(16) NOT NULL,
        "gmailMessageId" character varying(64),
        "gmailThreadId" character varying(64),
        "sentAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_mail_send" PRIMARY KEY (id),
        CONSTRAINT "CHK_mail_send_status" CHECK (status IN ('sending', 'sent', 'failed')),
        CONSTRAINT "CHK_mail_send_kind" CHECK (kind IN ('new', 'reply', 'reply_all', 'forward', 'draft'))
      )`,
    );
    for (const statement of INDEXES) await queryRunner.query(statement);
    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE mail_send');
  }
}

const INDEXES = [
  `CREATE UNIQUE INDEX "UQ_mail_send_approval" ON mail_send USING btree ("approvalId")`,
  `CREATE INDEX "IDX_mail_send_connection_created" ON mail_send USING btree ("connectionId", "createdAt")`,
  `CREATE INDEX "IDX_mail_send_user_created" ON mail_send USING btree ("organizationId", "userId", "createdAt")`,
  `CREATE INDEX "IDX_mail_send_user" ON mail_send USING btree ("userId")`,
  `CREATE INDEX "IDX_mail_send_bot" ON mail_send USING btree ("botId")`,
];

const FOREIGN_KEYS = [
  `ALTER TABLE mail_send ADD CONSTRAINT "FK_mail_send_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE mail_send ADD CONSTRAINT "FK_mail_send_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  `ALTER TABLE mail_send ADD CONSTRAINT "FK_mail_send_connection" FOREIGN KEY ("connectionId") REFERENCES gmail_connection(id) ON DELETE SET NULL`,
  `ALTER TABLE mail_send ADD CONSTRAINT "FK_mail_send_bot" FOREIGN KEY ("botId") REFERENCES bot(id) ON DELETE SET NULL`,
];
