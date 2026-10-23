import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Images in a bot's chat (`product/versions/mvp/25-bots.md` §3.1).
 *
 * - `bot_attachment`: one row per image uploaded to a bot's composer, the
 *   file itself in storage under `"storageKey"`. An image is uploaded when
 *   it is picked, so the composer can show it and refuse it before the
 *   message goes; `"messageId"` is set when the message that carries it is
 *   sent (a conditional `UPDATE … WHERE "messageId" IS NULL`, in the send's
 *   transaction, so one image is claimed by one message).
 * - `bot_message."attachments"`: what the chat shows of a message's images
 *   (id, type, size, name), read whole with the message, so no read of the
 *   chat joins the attachment table.
 *
 * The row outlives what it names, on purpose: a file in storage is not
 * deleted by a cascade, so the row has to stay long enough for the sweep
 * (`bot-attachment-retention`) to delete the file and then the row.
 * `"organizationId"` and `"botId"` therefore have no foreign key (deleting
 * a workspace or a bot leaves its rows for the sweep), and `"messageId"` is
 * `ON DELETE SET NULL`: clearing a chat, or deleting the bot and with it
 * its messages, makes an image unclaimed again. The sweep deletes every
 * unclaimed image older than a day: an upload never sent, or one whose
 * message is gone. `"uploadedByUserId"` is who may send it, `SET NULL`
 * when that account goes, which leaves the image unsendable until swept.
 *
 * Access patterns:
 * - read one image of a bot (the chat's thumbnail), claim a message's images
 *   on send: by primary key;
 * - a turn's images: `IDX_bot_attachment_message`, which also backs the
 *   foreign key;
 * - the sweep: `IDX_bot_attachment_unclaimed`, oldest first.
 */
export class AddBotAttachments1791003200000 implements MigrationInterface {
  name = 'AddBotAttachments1791003200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bot_attachment (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "uploadedByUserId" uuid,
        "messageId" uuid,
        "storageKey" varchar(255) NOT NULL,
        "mimeType" varchar(16) NOT NULL,
        "sizeBytes" integer NOT NULL,
        name varchar(255) NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_attachment" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_attachment_mime_type" CHECK ("mimeType" IN ('image/png', 'image/jpeg', 'image/gif', 'image/webp')),
        CONSTRAINT "CHK_bot_attachment_size" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 5242880)
      )
    `);
    await queryRunner.query(
      `ALTER TABLE bot_attachment ADD CONSTRAINT "FK_bot_attachment_message" FOREIGN KEY ("messageId") REFERENCES bot_message(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_attachment ADD CONSTRAINT "FK_bot_attachment_uploaded_by" FOREIGN KEY ("uploadedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_attachment_message" ON bot_attachment ("messageId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_attachment_uploaded_by" ON bot_attachment ("uploadedByUserId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_attachment_unclaimed" ON bot_attachment ("createdAt") WHERE "messageId" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_message ADD COLUMN "attachments" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_message DROP COLUMN "attachments"`);
    await queryRunner.query(`DROP TABLE bot_attachment`);
  }
}
