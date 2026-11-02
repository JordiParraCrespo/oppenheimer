import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * WhatsApp (`product/next-steps/whatsapp.md`): a number a person owns, joined
 * as a linked device by the runner on one of their hosts, the way OpenClaw
 * joins one, and the messages it sees, kept so their bots can read the chats.
 *
 * `whatsapp_account` is the number: which host's runner holds its device (one
 * per host, since a runner holds one device: `UQ_whatsapp_account_host`), its
 * name, and the device's state as the host last reported it, with the QR code
 * while it pairs. The device's keys never leave the host and are not here.
 *
 * `whatsapp_message` is what the number saw, its owner's own messages from the
 * phone included, and what bots sent through it. WhatsApp has no API that
 * reads a linked device's history, so a bot reads this. Keyed by WhatsApp's own
 * id within its chat, so a message the runner sends twice (a link that dropped
 * before the ack) is one row. It sorts on `sentAt`, WhatsApp's time, never the
 * insert's.
 *
 * Access patterns:
 * - a person's numbers, in Settings and in a bot's turn:
 *   `IDX_whatsapp_account_owner`, which also backs the foreign key to the
 *   workspace; the one on a host, when it reports: `UQ_whatsapp_account_host`,
 *   which backs the foreign key to `host`;
 * - a number's chats, newest first, and its messages over a time range (the
 *   day's bot sends, the retention delete): `IDX_whatsapp_message_account_sent`;
 * - one chat's messages, newest first: `IDX_whatsapp_message_chat`;
 * - intake's dedupe: `UQ_whatsapp_message_external`, whose leading columns
 *   back the composite foreign key to the account.
 *
 * A message references its account on `("organizationId", "id")`, so it can
 * never point into another workspace, and goes with it. `sentByBotId` only
 * loses its link when the bot is deleted.
 *
 * Retention: messages older than `WHATSAPP_RETENTION_DAYS` (90) are deleted
 * by intake, in batches per account, as new ones arrive; a number that
 * receives nothing keeps its last messages until it is unlinked. The table
 * grows with the number's traffic and is a partitioning candidate on
 * `sentAt` past a few tens of millions of rows.
 *
 * `owner` gains `manage Whatsapp` in its workspace; every read adds the owner,
 * so a workspace owner never reads another person's chats.
 */
export class AddWhatsapp1793520484168 implements MigrationInterface {
  name = 'AddWhatsapp1793520484168';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE whatsapp_account (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "hostId" uuid NOT NULL,
        label character varying(64) NOT NULL,
        status character varying(16) DEFAULT 'pairing'::character varying NOT NULL,
        phone character varying(128),
        "displayName" character varying(200),
        qr character varying(1024),
        "qrExpiresAt" timestamp with time zone,
        "statusReason" character varying(200),
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_whatsapp_account" PRIMARY KEY (id),
        CONSTRAINT "CHK_whatsapp_account_status"
          CHECK (status IN ('pairing', 'connecting', 'connected', 'logged_out', 'unlinked'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_whatsapp_account_host" ON whatsapp_account USING btree ("hostId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_whatsapp_account_organization_id" ON whatsapp_account USING btree ("organizationId", id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_account_owner" ON whatsapp_account USING btree ("organizationId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_account_user" ON whatsapp_account USING btree ("userId")`,
    );

    await queryRunner.query(
      `CREATE TABLE whatsapp_message (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "accountId" uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "externalId" character varying(128) NOT NULL,
        "chatId" character varying(128) NOT NULL,
        "chatKind" character varying(8) NOT NULL,
        "chatName" character varying(200),
        "senderId" character varying(128) NOT NULL,
        "senderName" character varying(200),
        "fromMe" boolean NOT NULL,
        text text NOT NULL,
        media character varying(16),
        "quotedId" character varying(128),
        "sentAt" timestamp with time zone NOT NULL,
        "sentByBotId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_whatsapp_message" PRIMARY KEY (id),
        CONSTRAINT "CHK_whatsapp_message_chat_kind" CHECK ("chatKind" IN ('direct', 'group'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_whatsapp_message_external" ON whatsapp_message USING btree ("organizationId", "accountId", "chatId", "externalId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_message_chat" ON whatsapp_message USING btree ("organizationId", "accountId", "chatId", "sentAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_message_account_sent" ON whatsapp_message USING btree ("organizationId", "accountId", "sentAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_message_bot" ON whatsapp_message USING btree ("sentByBotId") WHERE "sentByBotId" IS NOT NULL`,
    );
    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);

    await queryRunner.query(
      `UPDATE "role" SET permissions = permissions || $1::jsonb
        WHERE name = 'owner' AND "organizationId" IS NULL AND "isSystem"`,
      [JSON.stringify(OWNER_RULES)],
    );
    await queryRunner.query(`UPDATE "role_catalog_version" SET "version" = "version" + 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "role" SET permissions = (
         SELECT COALESCE(jsonb_agg(rule), '[]'::jsonb)
           FROM jsonb_array_elements(permissions) rule
          WHERE NOT (rule->>'subject' = ANY($1))
       )
       WHERE name = 'owner' AND "organizationId" IS NULL AND "isSystem"`,
      [OWNER_RULES.map((rule) => rule.subject)],
    );
    await queryRunner.query(`UPDATE "role_catalog_version" SET "version" = "version" + 1`);
    await queryRunner.query('DROP TABLE whatsapp_message');
    await queryRunner.query('DROP TABLE whatsapp_account');
  }
}

const OWNER_RULES = [
  {
    action: 'manage',
    subject: 'Whatsapp',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

const FOREIGN_KEYS = [
  `ALTER TABLE whatsapp_account ADD CONSTRAINT "FK_whatsapp_account_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE whatsapp_account ADD CONSTRAINT "FK_whatsapp_account_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  `ALTER TABLE whatsapp_account ADD CONSTRAINT "FK_whatsapp_account_host" FOREIGN KEY ("hostId") REFERENCES host(id) ON DELETE CASCADE`,
  `ALTER TABLE whatsapp_message ADD CONSTRAINT "FK_whatsapp_message_account" FOREIGN KEY ("organizationId", "accountId") REFERENCES whatsapp_account("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE whatsapp_message ADD CONSTRAINT "FK_whatsapp_message_bot" FOREIGN KEY ("sentByBotId") REFERENCES bot(id) ON DELETE SET NULL`,
];
