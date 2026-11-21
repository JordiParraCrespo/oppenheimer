import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The chats a linked WhatsApp number can be reached in before anyone writes
 * there, as its host's device reports them (`whatsapp.chats`): the groups it
 * is in and the people among its contacts. Settings lists them beside the
 * chats the number has seen, so a group can be answered before its next
 * message.
 *
 * Access patterns: Settings reads a number's whole list
 * (`IDX_whatsapp_known_chat_account`); the device's report is an upsert by
 * chat, one row per chat and number (`UQ_whatsapp_known_chat_chat`).
 *
 * - `"accountId"`: `CASCADE`, so unlinking a number forgets its chats.
 * - `"chatName"`: the group's subject or the contact's saved name, as last
 *   reported; null when the device knows none.
 * - `"reportedAt"`: when the device last reported it. Nothing is deleted on a
 *   report: one comes in several frames, and none says it is the last.
 * - At most `WHATSAPP_KNOWN_CHATS_MAX` per number, counted on write.
 */
export class AddWhatsappKnownChats1795200000000 implements MigrationInterface {
  name = 'AddWhatsappKnownChats1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE whatsapp_known_chat (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "accountId" uuid NOT NULL,
        "chatId" character varying(128) NOT NULL,
        "chatKind" character varying(8) NOT NULL,
        "chatName" character varying(200),
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "reportedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_whatsapp_known_chat" PRIMARY KEY (id),
        CONSTRAINT "CHK_whatsapp_known_chat_chat_kind" CHECK ("chatKind" IN ('direct', 'group'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_whatsapp_known_chat_chat" ON whatsapp_known_chat USING btree ("accountId", "chatId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_whatsapp_known_chat_account" ON whatsapp_known_chat USING btree ("organizationId", "accountId")`,
    );
    await queryRunner.query(
      `ALTER TABLE whatsapp_known_chat ADD CONSTRAINT "FK_whatsapp_known_chat_account" FOREIGN KEY ("organizationId", "accountId") REFERENCES whatsapp_account("organizationId", id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE whatsapp_known_chat`);
  }
}
