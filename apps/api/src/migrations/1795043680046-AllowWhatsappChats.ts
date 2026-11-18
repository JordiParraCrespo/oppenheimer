import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The chats a linked WhatsApp number allows besides its owner's: a group or
 * another person, and the bot that answers there. Only the owner allows
 * them: signed in to the console, or by asking a bot in their own chat.
 *
 * Access patterns: Settings and a bot's tools list a number's allowed chats,
 * oldest first (`IDX_whatsapp_chat_grant_account`); allowing a chat finds it
 * on its number first, and one chat is allowed once per number
 * (`UQ_whatsapp_chat_grant_chat`); a bot that answers in one is found before
 * it is deleted (`IDX_whatsapp_chat_grant_bot`), and the grants a deleted bot
 * made lose it (`IDX_whatsapp_chat_grant_granted_by_bot`).
 *
 * - `"accountId"`: `CASCADE`, so unlinking a number forgets what it allowed.
 * - `"botId"`: the bot that answers in the chat, null for the number's
 *   default. `NO ACTION`: a bot that answers in one is not deleted until
 *   another is chosen (`BOTS_043`), as a number's default.
 * - `"grantedByBotId"`: the bot whose tool allowed it, in the owner's own
 *   chat with it; null when allowed in Settings. `SET NULL` when it goes:
 *   the grant was the owner's ask and stays.
 * - `"chatName"`: the name as the number last saw it, for Settings; refreshed
 *   when the chat is allowed again.
 * - At most 50 per number (`WHATSAPP_CHAT_GRANTS_MAX`), counted on write.
 */
export class AllowWhatsappChats1795043680046 implements MigrationInterface {
  name = 'AllowWhatsappChats1795043680046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE whatsapp_chat_grant (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "accountId" uuid NOT NULL,
        "chatId" character varying(128) NOT NULL,
        "chatKind" character varying(8) NOT NULL,
        "chatName" character varying(200),
        "botId" uuid,
        "grantedByBotId" uuid,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_whatsapp_chat_grant" PRIMARY KEY (id),
        CONSTRAINT "CHK_whatsapp_chat_grant_chat_kind" CHECK ("chatKind" IN ('direct', 'group'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_whatsapp_chat_grant_chat" ON whatsapp_chat_grant USING btree ("accountId", "chatId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_chat_grant_account" ON whatsapp_chat_grant USING btree ("organizationId", "accountId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_chat_grant_bot" ON whatsapp_chat_grant USING btree ("organizationId", "botId") WHERE "botId" IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_chat_grant_granted_by_bot" ON whatsapp_chat_grant USING btree ("grantedByBotId") WHERE "grantedByBotId" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_chat_grant ADD CONSTRAINT "FK_whatsapp_chat_grant_account" FOREIGN KEY ("organizationId", "accountId") REFERENCES whatsapp_account("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_chat_grant ADD CONSTRAINT "FK_whatsapp_chat_grant_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_chat_grant ADD CONSTRAINT "FK_whatsapp_chat_grant_granted_by_bot" FOREIGN KEY ("grantedByBotId") REFERENCES bot(id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE whatsapp_chat_grant`);
  }
}
