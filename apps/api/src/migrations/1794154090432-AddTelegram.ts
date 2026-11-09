import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Telegram (`product/next-steps/telegram.md`): a bot a person made with
 * @BotFather, long-polled on the Bot API by the runner on one of their hosts,
 * the way OpenClaw runs one, and the messages it receives, kept so their
 * Oppenheimer bots can read the chats.
 *
 * `telegram_account` is the Telegram bot: which host's runner holds its token
 * and polls (one per host, since a token polled from two places loses updates:
 * `UQ_telegram_account_host`), its name, and its state as the host last
 * reported it, with the bot's id, `@username` and name once the host checked
 * the token. The token never leaves the host and is not here.
 *
 * `telegram_message` is what the Telegram bot received, and what Oppenheimer
 * bots sent through it. The Bot API has no history to read, so a bot reads
 * this. Keyed by Telegram's own message id within its chat, so a message the
 * runner sends twice (a link that dropped before the ack) is one row. Ids are
 * Telegram's signed 64-bit integers kept as text (`varchar(21)`), so no tier
 * loses precision. It sorts on `sentAt`, Telegram's time, never the insert's.
 *
 * Access patterns:
 * - a person's Telegram bots, in Settings and in a bot's turn:
 *   `IDX_telegram_account_owner`, which also backs the foreign key to the
 *   workspace; the one on a host, when it reports: `UQ_telegram_account_host`,
 *   which backs the foreign key to `host`;
 * - a Telegram bot's chats, newest first, and its messages over a time range
 *   (the day's bot sends, the retention delete): `IDX_telegram_message_account_sent`;
 * - one chat's messages, newest first: `IDX_telegram_message_chat`;
 * - intake's dedupe: `UQ_telegram_message_external`, whose leading columns
 *   back the composite foreign key to the account.
 *
 * A message references its account on `("organizationId", "id")`, so it can
 * never point into another workspace, and goes with it. `sentByBotId` only
 * loses its link when the bot is deleted.
 *
 * Retention: messages older than `TELEGRAM_RETENTION_DAYS` (90) are deleted
 * by intake, in batches per account, as new ones arrive, and past
 * `TELEGRAM_MESSAGES_KEPT_MAX` (50,000) per account the oldest go; a bot
 * that receives nothing keeps its last messages until it is disconnected.
 *
 * `owner` gains `manage Telegram` in its workspace; every read adds the owner,
 * so a workspace owner never reads another person's chats.
 */
export class AddTelegram1794154090432 implements MigrationInterface {
  name = 'AddTelegram1794154090432';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE telegram_account (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "hostId" uuid NOT NULL,
        label character varying(64) NOT NULL,
        status character varying(16) DEFAULT 'connecting'::character varying NOT NULL,
        "botId" character varying(21),
        username character varying(64),
        "displayName" character varying(200),
        "statusReason" character varying(200),
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_telegram_account" PRIMARY KEY (id),
        CONSTRAINT "CHK_telegram_account_status"
          CHECK (status IN ('connecting', 'connected', 'revoked', 'unlinked'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_telegram_account_host" ON telegram_account USING btree ("hostId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_telegram_account_organization_id" ON telegram_account USING btree ("organizationId", id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_account_owner" ON telegram_account USING btree ("organizationId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_account_user" ON telegram_account USING btree ("userId")`,
    );

    await queryRunner.query(
      `CREATE TABLE telegram_message (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "accountId" uuid NOT NULL,
        "organizationId" uuid NOT NULL,
        "externalId" character varying(21) NOT NULL,
        "chatId" character varying(21) NOT NULL,
        "chatKind" character varying(8) NOT NULL,
        "chatName" character varying(200),
        "senderId" character varying(21) NOT NULL,
        "senderName" character varying(200),
        "senderUsername" character varying(64),
        "fromBot" boolean NOT NULL,
        text text NOT NULL,
        media character varying(16),
        "replyToId" character varying(21),
        "sentAt" timestamp with time zone NOT NULL,
        "sentByBotId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_telegram_message" PRIMARY KEY (id),
        CONSTRAINT "CHK_telegram_message_chat_kind" CHECK ("chatKind" IN ('direct', 'group'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_telegram_message_external" ON telegram_message USING btree ("organizationId", "accountId", "chatId", "externalId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_message_chat" ON telegram_message USING btree ("organizationId", "accountId", "chatId", "sentAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_message_account_sent" ON telegram_message USING btree ("organizationId", "accountId", "sentAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_message_bot" ON telegram_message USING btree ("sentByBotId") WHERE "sentByBotId" IS NOT NULL`,
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
    await queryRunner.query('DROP TABLE telegram_message');
    await queryRunner.query('DROP TABLE telegram_account');
  }
}

const OWNER_RULES = [
  {
    action: 'manage',
    subject: 'Telegram',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

const FOREIGN_KEYS = [
  `ALTER TABLE telegram_account ADD CONSTRAINT "FK_telegram_account_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE telegram_account ADD CONSTRAINT "FK_telegram_account_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  `ALTER TABLE telegram_account ADD CONSTRAINT "FK_telegram_account_host" FOREIGN KEY ("hostId") REFERENCES host(id) ON DELETE CASCADE`,
  `ALTER TABLE telegram_message ADD CONSTRAINT "FK_telegram_message_account" FOREIGN KEY ("organizationId", "accountId") REFERENCES telegram_account("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE telegram_message ADD CONSTRAINT "FK_telegram_message_bot" FOREIGN KEY ("sentByBotId") REFERENCES bot(id) ON DELETE SET NULL`,
];
