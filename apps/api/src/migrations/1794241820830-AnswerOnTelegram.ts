import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot answers its owner on Telegram, in a conversation of its own
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 1).
 *
 * Access patterns: a turn's history and the console's chat read a
 * conversation's messages in order (`IDX_bot_message_conversation`); a
 * Telegram message finds its chat's open conversation
 * (`UQ_bot_conversation_telegram_chat`); a bot's conversations are listed
 * and deleted with it (`IDX_bot_conversation_bot`); an account's are deleted
 * with it (`IDX_bot_conversation_telegram_account`); a bot answering a
 * Telegram bot is found before it is deleted
 * (`IDX_telegram_account_answering_bot`).
 *
 * - `bot_conversation`: a bot's conversations. Its console chat is one, whose
 *   id is the bot's own id, so every turn and line that existed is in it;
 *   a Telegram chat with the bot is another, opened by the first message and
 *   closed (`archivedAt`) by `/new`, which opens the next. At most one open
 *   per Telegram chat (`UQ_bot_conversation_telegram_chat`). Disconnecting
 *   the Telegram bot keeps the conversation and its turns, a running one
 *   included, and only forgets the account (`SET NULL`); the history goes
 *   with the bot or with Clear history.
 * - Lines a deleted bot left behind (written outside any turn, so with no
 *   key to the bot) are deleted first: they would point at no conversation.
 * - `bot_turn."conversationId"` and `bot_message."conversationId"`: the
 *   conversation each belongs to, backfilled with the bot's console chat. A
 *   turn's history is its conversation's messages.
 * - `bot_conversation_summary` stays one per bot: it summarises the console
 *   chat only, and a Telegram conversation is read without one.
 * - `telegram_account."answeringBotId"`: the Oppenheimer bot that answers
 *   it. `NO ACTION`: a bot that answers a Telegram bot is not deleted until
 *   it is unbound (the delete says so, `BOTS_042`).
 * - `telegram_account."ownerTelegramId"`: the Telegram user recorded as the
 *   owner by the one-time `start` link; `"ownerLinkCodeHash"` and
 *   `"ownerLinkExpiresAt"` hold that link's code, hashed, until it is used
 *   or ten minutes pass.
 * - `bot_turn."origin"` gains `telegram`.
 */
export class AnswerOnTelegram1794241820830 implements MigrationInterface {
  name = 'AnswerOnTelegram1794241820830';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE bot_conversation (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        kind character varying(16) NOT NULL,
        "telegramAccountId" uuid,
        "chatId" character varying(21),
        "archivedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_conversation" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_conversation_kind" CHECK (kind IN ('console', 'telegram')),
        CONSTRAINT "CHK_bot_conversation_console"
          CHECK ((kind = 'console') = (id = "botId")),
        CONSTRAINT "CHK_bot_conversation_telegram"
          CHECK ((kind = 'telegram') = ("chatId" IS NOT NULL)),
        CONSTRAINT "CHK_bot_conversation_console_account"
          CHECK (kind = 'telegram' OR "telegramAccountId" IS NULL)
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_conversation_organization_id" ON bot_conversation USING btree ("organizationId", id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_conversation_bot" ON bot_conversation USING btree ("organizationId", "botId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_conversation_telegram_chat" ON bot_conversation USING btree ("telegramAccountId", "chatId") WHERE "archivedAt" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_conversation_telegram_account" ON bot_conversation USING btree ("organizationId", "telegramAccountId") WHERE "telegramAccountId" IS NOT NULL`,
    );
    await queryRunner.query(
      `INSERT INTO bot_conversation (id, "organizationId", "botId", kind)
       SELECT id, "organizationId", id, 'console' FROM bot`,
    );

    // A line written outside any turn (a routine's, a dream's) had no key to
    // its bot, so a bot deleted before now left its lines behind; they belong
    // to no conversation and are read by nothing.
    await queryRunner.query(
      `DELETE FROM bot_message m
        WHERE NOT EXISTS (
          SELECT 1 FROM bot b WHERE b."organizationId" = m."organizationId" AND b.id = m."botId")`,
    );
    for (const table of ['bot_turn', 'bot_message']) {
      await queryRunner.query(`ALTER TABLE ${table} ADD "conversationId" uuid`);
      await queryRunner.query(`UPDATE ${table} SET "conversationId" = "botId"`);
      await queryRunner.query(`ALTER TABLE ${table} ALTER COLUMN "conversationId" SET NOT NULL`);
    }
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_turn_conversation" ON bot_turn USING btree ("organizationId", "conversationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_message_conversation" ON bot_message USING btree ("organizationId", "conversationId", "createdAt", id)`,
    );

    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram'))`,
    );

    await queryRunner.query(`ALTER TABLE telegram_account ADD "answeringBotId" uuid`);
    await queryRunner.query(
      `ALTER TABLE telegram_account ADD "ownerTelegramId" character varying(21)`,
    );
    await queryRunner.query(
      `ALTER TABLE telegram_account ADD "ownerLinkCodeHash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE telegram_account ADD "ownerLinkExpiresAt" timestamp with time zone`,
    );
    await queryRunner.query(
      `ALTER TABLE telegram_account ADD CONSTRAINT "CHK_telegram_account_owner_link" CHECK (("ownerLinkCodeHash" IS NULL) = ("ownerLinkExpiresAt" IS NULL))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_telegram_account_answering_bot" ON telegram_account USING btree ("organizationId", "answeringBotId") WHERE "answeringBotId" IS NOT NULL`,
    );

    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of [
      ['telegram_account', 'FK_telegram_account_answering_bot'],
      ['bot_message', 'FK_bot_message_conversation'],
      ['bot_turn', 'FK_bot_turn_conversation'],
      ['bot_conversation', 'FK_bot_conversation_telegram_account'],
      ['bot_conversation', 'FK_bot_conversation_bot'],
    ]) {
      await queryRunner.query(`ALTER TABLE ${name[0]} DROP CONSTRAINT "${name[1]}"`);
    }
    await queryRunner.query(`DROP INDEX "IDX_telegram_account_answering_bot"`);
    await queryRunner.query(
      `ALTER TABLE telegram_account DROP CONSTRAINT "CHK_telegram_account_owner_link"`,
    );
    for (const column of [
      'answeringBotId',
      'ownerTelegramId',
      'ownerLinkCodeHash',
      'ownerLinkExpiresAt',
    ]) {
      await queryRunner.query(`ALTER TABLE telegram_account DROP COLUMN "${column}"`);
    }
    await queryRunner.query(`DELETE FROM bot_turn WHERE "origin" = 'telegram'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop'))`,
    );
    await queryRunner.query(`DELETE FROM bot_message WHERE "conversationId" <> "botId"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_message_conversation"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_turn_conversation"`);
    await queryRunner.query(`ALTER TABLE bot_message DROP COLUMN "conversationId"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "conversationId"`);
    await queryRunner.query(`DROP TABLE bot_conversation`);
  }
}

const FOREIGN_KEYS = [
  `ALTER TABLE bot_conversation ADD CONSTRAINT "FK_bot_conversation_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE bot_conversation ADD CONSTRAINT "FK_bot_conversation_telegram_account" FOREIGN KEY ("organizationId", "telegramAccountId") REFERENCES telegram_account("organizationId", id) ON DELETE SET NULL ("telegramAccountId")`,
  `ALTER TABLE bot_turn ADD CONSTRAINT "FK_bot_turn_conversation" FOREIGN KEY ("organizationId", "conversationId") REFERENCES bot_conversation("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE bot_message ADD CONSTRAINT "FK_bot_message_conversation" FOREIGN KEY ("organizationId", "conversationId") REFERENCES bot_conversation("organizationId", id) ON DELETE CASCADE`,
  `ALTER TABLE telegram_account ADD CONSTRAINT "FK_telegram_account_answering_bot" FOREIGN KEY ("organizationId", "answeringBotId") REFERENCES bot("organizationId", id) ON DELETE NO ACTION`,
];
