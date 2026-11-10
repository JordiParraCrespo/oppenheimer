import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot answers its owner on WhatsApp, in a conversation of its own
 * (`product/next-steps/answering-on-telegram-and-whatsapp.md`, slice 3), as
 * `1794241820830-AnswerOnTelegram` did for Telegram.
 *
 * Access patterns: a message stored is told the chat's last `/new` and last
 * switch to a bot by name at or before it, from those messages alone
 * (`IDX_whatsapp_message_new`, partial on the command, and
 * `IDX_whatsapp_message_switch`, partial on a switch, both by `seq`); a
 * WhatsApp message finds the conversation of its chat with the bot that
 * starts at or before it (`UQ_bot_conversation_whatsapp_chat`); a number's
 * conversations lose it when it is unlinked
 * (`IDX_bot_conversation_whatsapp_account`); a bot that is a number's default,
 * or that a message switched to, is found before it is deleted
 * (`IDX_whatsapp_account_answering_bot`, `IDX_whatsapp_message_switches_to_bot`).
 *
 * - `whatsapp_message.seq`: the order the control plane stored the messages
 *   in. WhatsApp's ids are random strings, so this is what Telegram's
 *   numbered ids are to its chats: a conversation starts at a message's
 *   `seq`, and a message delivered again keeps its first row and its seq
 *   (`UQ_whatsapp_message_external`), so redelivery never moves a start.
 *   Identity rather than `sentAt`, which has ties and is the phone's clock.
 * - `whatsapp_message."switchesToBotId"`: the bot an owner's "Name: …" named,
 *   resolved when the message was stored, so a rename later does not change
 *   what it meant. `SET NULL`: deleting that bot leaves the chat with the
 *   switch before it, or the number's default. One column, not composite on
 *   the workspace: intake resolves the name among the owner's own bots.
 * - `whatsapp_message."isReply"`: the bot's answer to the owner's message,
 *   quoting it. It is recorded with the bot that wrote it but does not count
 *   toward the bot's sends a day, which guard writing to other chats. Its
 *   CHECK asks only that the number sent it: `"sentByBotId"` is `SET NULL`
 *   when the bot is deleted, and the reply stays in the chat.
 * - `whatsapp_account."answeringBotId"`: the number's default bot. `NO ACTION`:
 *   a bot that is a number's default is not deleted until another is chosen
 *   (the delete says so, `BOTS_043`).
 * - `whatsapp_account."ownerPhone"`: the owner's own number, as its JID,
 *   confirmed by the six-digit code the spare number sent to it and the
 *   owner entered in Settings. `"ownerPendingPhone"`, `"ownerCodeHash"` and
 *   `"ownerCodeExpiresAt"` hold a code waiting to be entered, all three or
 *   none, hashed; `"ownerCodeAttempts"` counts the wrong ones, five at most.
 *   A pending code is replaced by the next request and expires after ten
 *   minutes, read on confirm; nothing sweeps it.
 * - `bot_conversation` gains the `whatsapp` kind and its account
 *   (`SET NULL` on unlinking, as Telegram's); `"chatId"` widens to a JID's
 *   128 characters, and `"startsAtMessageId"` holds the starting `seq`. The
 *   two Telegram-only checks become one per rule across channels.
 * - `bot_turn."origin"` gains `whatsapp`.
 */
export class AnswerOnWhatsapp1794256897181 implements MigrationInterface {
  name = 'AnswerOnWhatsapp1794256897181';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE whatsapp_account ADD "answeringBotId" uuid`);
    await queryRunner.query(`ALTER TABLE whatsapp_account ADD "ownerPhone" character varying(128)`);
    await queryRunner.query(
      `ALTER TABLE whatsapp_account ADD "ownerPendingPhone" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_account ADD "ownerCodeHash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_account ADD "ownerCodeExpiresAt" timestamp with time zone`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_account ADD "ownerCodeAttempts" smallint DEFAULT 0 NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_account ADD CONSTRAINT "CHK_whatsapp_account_owner_code" CHECK (num_nonnulls("ownerPendingPhone", "ownerCodeHash", "ownerCodeExpiresAt") IN (0, 3))`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_account ADD CONSTRAINT "CHK_whatsapp_account_owner_code_attempts" CHECK ("ownerCodeAttempts" BETWEEN 0 AND 5)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_account_answering_bot" ON whatsapp_account USING btree ("organizationId", "answeringBotId") WHERE "answeringBotId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE whatsapp_message ADD seq bigint GENERATED ALWAYS AS IDENTITY NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE whatsapp_message ADD "switchesToBotId" uuid`);
    await queryRunner.query(
      `ALTER TABLE whatsapp_message ADD "isReply" boolean DEFAULT false NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_message ADD CONSTRAINT "CHK_whatsapp_message_reply" CHECK (NOT "isReply" OR "fromMe")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_message_switch" ON whatsapp_message USING btree ("organizationId", "accountId", "chatId", seq) WHERE "switchesToBotId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_message_new" ON whatsapp_message USING btree ("organizationId", "accountId", "chatId", seq) WHERE NOT "fromMe" AND text ~* '^\\s*/new\\s*$'`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_message_switches_to_bot" ON whatsapp_message USING btree ("switchesToBotId") WHERE "switchesToBotId" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_kind" CHECK (kind IN ('console', 'telegram', 'whatsapp'))`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_telegram"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_console_account"`,
    );
    await queryRunner.query(`ALTER TABLE bot_conversation ADD "whatsappAccountId" uuid`);
    await queryRunner.query(
      `ALTER TABLE bot_conversation ALTER COLUMN "chatId" TYPE character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_channel" CHECK ((kind = 'console') = ("chatId" IS NULL) AND ("chatId" IS NULL) = ("startsAtMessageId" IS NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_account" CHECK ((kind = 'telegram' OR "telegramAccountId" IS NULL) AND (kind = 'whatsapp' OR "whatsappAccountId" IS NULL))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_conversation_whatsapp_chat" ON bot_conversation USING btree ("whatsappAccountId", "chatId", "botId", "startsAtMessageId") WHERE "whatsappAccountId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_conversation_whatsapp_account" ON bot_conversation USING btree ("organizationId", "whatsappAccountId") WHERE "whatsappAccountId" IS NOT NULL`,
    );

    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram', 'whatsapp'))`,
    );

    for (const statement of FOREIGN_KEYS) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, name] of [
      ['bot_conversation', 'FK_bot_conversation_whatsapp_account'],
      ['whatsapp_message', 'FK_whatsapp_message_switches_to_bot'],
      ['whatsapp_account', 'FK_whatsapp_account_answering_bot'],
    ]) {
      await queryRunner.query(`ALTER TABLE ${table} DROP CONSTRAINT "${name}"`);
    }

    // A WhatsApp conversation's turns and messages go with it
    // (FK_bot_turn_conversation, FK_bot_message_conversation); an answer to an
    // ask made there is a WhatsApp turn of that conversation too.
    await queryRunner.query(`DELETE FROM bot_conversation WHERE kind = 'whatsapp'`);
    await queryRunner.query(`DELETE FROM bot_turn WHERE "origin" = 'whatsapp'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK ("origin" IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop', 'telegram'))`,
    );

    await queryRunner.query(`DROP INDEX "IDX_bot_conversation_whatsapp_account"`);
    await queryRunner.query(`DROP INDEX "UQ_bot_conversation_whatsapp_chat"`);
    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_account"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_channel"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation ALTER COLUMN "chatId" TYPE character varying(21)`,
    );
    await queryRunner.query(`ALTER TABLE bot_conversation DROP COLUMN "whatsappAccountId"`);
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_console_account" CHECK (kind = 'telegram' OR "telegramAccountId" IS NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_telegram" CHECK ((kind = 'telegram') = ("chatId" IS NOT NULL AND "startsAtMessageId" IS NOT NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation DROP CONSTRAINT "CHK_bot_conversation_kind"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation ADD CONSTRAINT "CHK_bot_conversation_kind" CHECK (kind IN ('console', 'telegram'))`,
    );

    await queryRunner.query(`DROP INDEX "IDX_whatsapp_message_switches_to_bot"`);
    await queryRunner.query(`DROP INDEX "IDX_whatsapp_message_new"`);
    await queryRunner.query(`DROP INDEX "IDX_whatsapp_message_switch"`);
    await queryRunner.query(
      `ALTER TABLE whatsapp_message DROP CONSTRAINT "CHK_whatsapp_message_reply"`,
    );
    for (const column of ['isReply', 'switchesToBotId', 'seq']) {
      await queryRunner.query(`ALTER TABLE whatsapp_message DROP COLUMN "${column}"`);
    }

    await queryRunner.query(`DROP INDEX "IDX_whatsapp_account_answering_bot"`);
    await queryRunner.query(
      `ALTER TABLE whatsapp_account DROP CONSTRAINT "CHK_whatsapp_account_owner_code_attempts"`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_account DROP CONSTRAINT "CHK_whatsapp_account_owner_code"`,
    );
    for (const column of [
      'ownerCodeAttempts',
      'ownerCodeExpiresAt',
      'ownerCodeHash',
      'ownerPendingPhone',
      'ownerPhone',
      'answeringBotId',
    ]) {
      await queryRunner.query(`ALTER TABLE whatsapp_account DROP COLUMN "${column}"`);
    }
  }
}

const FOREIGN_KEYS = [
  `ALTER TABLE whatsapp_account ADD CONSTRAINT "FK_whatsapp_account_answering_bot" FOREIGN KEY ("organizationId", "answeringBotId") REFERENCES bot("organizationId", id) ON DELETE NO ACTION`,
  `ALTER TABLE whatsapp_message ADD CONSTRAINT "FK_whatsapp_message_switches_to_bot" FOREIGN KEY ("switchesToBotId") REFERENCES bot(id) ON DELETE SET NULL`,
  `ALTER TABLE bot_conversation ADD CONSTRAINT "FK_bot_conversation_whatsapp_account" FOREIGN KEY ("organizationId", "whatsappAccountId") REFERENCES whatsapp_account("organizationId", id) ON DELETE SET NULL ("whatsappAccountId")`,
];
