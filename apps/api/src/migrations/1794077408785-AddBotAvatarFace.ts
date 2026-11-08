import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The face a bot wears (`25-bots.md` §7, "Changed 2026-11-07"): the hat,
 * the eyes and the mouth its owner picked in Profile.
 *
 * - `bot."avatarFace"`: `jsonb`, `{ "hat", "eyes", "mouth" }`, read whole
 *   with the bot and never filtered on. Nullable: null is "not picked", and
 *   the console draws the face the bot's id picks, so every bot already here
 *   keeps the face it has today.
 * - `CHK_bot_avatar_face` holds each part to the lists in
 *   `@oppenheimer/shared` (`BOT_FACE_*`), as `CHK_bot_avatar_color` holds the
 *   colour. `IS TRUE`, because a part left out reads as NULL and a NULL
 *   would pass the check.
 *
 * No index: nothing looks a bot up by its face.
 */
export class AddBotAvatarFace1794077408785 implements MigrationInterface {
  name = 'AddBotAvatarFace1794077408785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot ADD COLUMN "avatarFace" jsonb`);
    await queryRunner.query(
      `ALTER TABLE bot ADD CONSTRAINT "CHK_bot_avatar_face" CHECK ("avatarFace" IS NULL OR ("avatarFace" ->> 'hat' IN ('fedora', 'porkpie', 'bowler', 'tophat', 'cap', 'beanie') AND "avatarFace" ->> 'eyes' IN ('dots', 'happy', 'wink', 'big') AND "avatarFace" ->> 'mouth' IN ('smile', 'grin', 'o')) IS TRUE)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot DROP CONSTRAINT "CHK_bot_avatar_face"`);
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "avatarFace"`);
  }
}
