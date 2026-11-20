import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slack: each bot's own Slack app, so it has its own name and face in Slack,
 * and the threads it answers in as conversations of the bot.
 *
 * `slack_account` is the app: the bot it is (one app per bot,
 * `UQ_slack_account_bot`), the Slack workspace and bot user Slack named when
 * its token was checked (one app is one bot, `UQ_slack_account_app`), its bot
 * token and signing secret sealed under `SLACK_TOKEN_KEY` (AES-256-GCM, the
 * API's sealed-blob layout), and the owner's Slack user once a one-time
 * `link` code recorded it. The code is stored hashed with its expiry, both or
 * neither (`CHK_slack_account_owner_link`); nothing sweeps an expired one.
 *
 * Access patterns:
 * - the caller's apps, in a bot's settings: `IDX_slack_account_owner`, which
 *   also backs the foreign key to the workspace;
 * - the app a bot's events address names, on every event:
 *   `UQ_slack_account_bot`, which backs the foreign key to the bot;
 * - a reply's app by its id: `UQ_slack_account_organization_id`, the target of
 *   `bot_conversation`'s composite key.
 *
 * The app goes with its bot (`CASCADE`): it is the bot's identity in Slack,
 * and answers as no other. It goes with its workspace and its owner too.
 *
 * `bot_conversation` gains the `slack` kind and its app (`SET NULL` on
 * disconnecting, as Telegram's): a Slack thread is one conversation from its
 * first message, so `"chatId"` is `<channel>:<thread ts>` and
 * `"startsAtMessageId"` is 0. `bot_turn."origin"` gains `slack`.
 *
 * `owner` gains `manage Slack` in its workspace; every read adds the owner.
 */
export class AddSlack1795193700000 implements MigrationInterface {
  name = 'AddSlack1795193700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE slack_account (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        status character varying(16) DEFAULT 'connected'::character varying NOT NULL,
        "statusReason" character varying(200),
        "teamId" character varying(32) NOT NULL,
        "teamName" character varying(200) NOT NULL,
        "botUserId" character varying(32) NOT NULL,
        "botName" character varying(200) NOT NULL,
        "sealedBotToken" bytea NOT NULL,
        "sealedSigningSecret" bytea NOT NULL,
        "tokenHint" character varying(8) NOT NULL,
        "ownerSlackUserId" character varying(32),
        "ownerLinkCodeHash" character varying(64),
        "ownerLinkExpiresAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_slack_account" PRIMARY KEY (id),
        CONSTRAINT "CHK_slack_account_status" CHECK (status IN ('connected', 'revoked')),
        CONSTRAINT "CHK_slack_account_owner_link"
          CHECK (("ownerLinkCodeHash" IS NULL) = ("ownerLinkExpiresAt" IS NULL))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_slack_account_organization_id" ON slack_account USING btree ("organizationId", id)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_slack_account_bot" ON slack_account USING btree ("botId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_slack_account_app" ON slack_account USING btree ("teamId", "botUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_slack_account_owner" ON slack_account USING btree ("organizationId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_slack_account_user" ON slack_account USING btree ("userId")`,
    );

    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_kind" CHECK (kind IN ('console', 'telegram', 'whatsapp', 'slack'))`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_account"`,
    );
    await queryRunner.query(`ALTER TABLE bot_conversation ADD "slackAccountId" uuid`);
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_account" CHECK ((kind = 'telegram' OR "telegramAccountId" IS NULL) AND (kind = 'whatsapp' OR "whatsappAccountId" IS NULL) AND (kind = 'slack' OR "slackAccountId" IS NULL))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_conversation_slack_chat" ON bot_conversation USING btree ("slackAccountId", "chatId", "botId", "startsAtMessageId") WHERE "slackAccountId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_conversation_slack_account" ON bot_conversation USING btree ("organizationId", "slackAccountId") WHERE "slackAccountId" IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram', 'whatsapp', 'slack'))`,
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

    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "FK_bot_conversation_slack_account"`,
    );
    // A Slack thread's turns and messages go with its conversation
    // (FK_bot_turn_conversation, FK_bot_message_conversation).
    await queryRunner.query(`DELETE FROM bot_conversation WHERE kind = 'slack'`);
    await queryRunner.query(`DELETE FROM bot_turn WHERE "origin" = 'slack'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram', 'whatsapp'))`,
    );

    await queryRunner.query(`DROP INDEX "IDX_bot_conversation_slack_account"`);
    await queryRunner.query(`DROP INDEX "UQ_bot_conversation_slack_chat"`);
    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_account"`,
    );
    await queryRunner.query(`ALTER TABLE bot_conversation DROP COLUMN "slackAccountId"`);
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_account" CHECK ((kind = 'telegram' OR "telegramAccountId" IS NULL) AND (kind = 'whatsapp' OR "whatsappAccountId" IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_kind" CHECK (kind IN ('console', 'telegram', 'whatsapp'))`,
    );

    await queryRunner.query('DROP TABLE slack_account');
  }
}

const OWNER_RULES = [
  {
    action: 'manage',
    subject: 'Slack',
    conditions: { organizationId: '${activeOrganizationId}' },
  },
];

const FOREIGN_KEYS = [
  `ALTER TABLE slack_account ADD CONSTRAINT "FK_slack_account_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE`,
  `ALTER TABLE slack_account ADD CONSTRAINT "FK_slack_account_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE`,
  `ALTER TABLE slack_account ADD CONSTRAINT "FK_slack_account_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE bot_conversation ADD CONSTRAINT "FK_bot_conversation_slack_account" FOREIGN KEY ("organizationId", "slackAccountId") REFERENCES slack_account("organizationId", id) ON DELETE SET NULL ("slackAccountId")`,
];
