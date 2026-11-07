import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot's dream (`product/versions/mvp/25-bots.md` §4.1, "Dreaming"): an
 * offline pass of its own model that rewrites the facts it wrote, and what
 * it takes to undo the latest one.
 *
 * - `bot_memory_dream`: one row per bot, its latest dream and its latest
 *   try, keyed by
 *   `("organizationId", "botId")`, which is also the composite foreign key to
 *   `bot` (`ON DELETE CASCADE`). A new dream overwrites the row: only the
 *   latest can be undone, and what came before it is what that dream read.
 *   - `triedAt`: when a dream last started, whether or not it wrote
 *     anything. The trigger waits a day from it, so a bot whose dreams keep
 *     coming back unusable (or losing to a save) pays for one a day, not one
 *     a turn. A row may hold only this, before the first dream that wrote.
 *   - `requestedAt`: when its owner asked for one (Tidy now), cleared by the
 *     job when it ends, whatever it came to; the console reads the dream as
 *     under way while it is set, for ten minutes at most, so a lost job
 *     does not hold the row.
 *   - The dream itself: `id`, `factsBefore`, `factsAfter`, `snapshot`,
 *     `outputFactIds` and `createdAt`, all set or none
 *     (`CHK_bot_memory_dream_applied`), and `undoneAt` only on a dream.
 *   - `id` names the dream, and the chat's line about it; unique.
 *   - `factsBefore`, `factsAfter`: the facts it rewrote and what it wrote.
 *   - `note`: what it changed, in its own words (`BOT_DREAM_NOTE_MAX`).
 *   - `snapshot`: the facts it replaced, whole rows as `jsonb`, read only by
 *     an undo, which puts them back with their own ids and dates. At most
 *     `BOT_MEMORY_FACTS_MAX` facts of 500 characters, about 300 kB.
 *   - `outputFactIds`: the facts it wrote, which an undo deletes. A fact the
 *     bot saved since is in neither list and stays.
 *   - `createdAt` is when the dream ran (a new dream rewrites it with the
 *     row); `undoneAt` is set once, by the undo, so a second undo finds
 *     nothing to do.
 * - `bot_model_call.purpose` gains `dream`, so `/usage` counts its spend.
 *
 * Access patterns: the trigger's and the console's read of a bot's dream,
 * the dream's own write and the undo, all by `PK_bot_memory_dream`, which also
 * backs the foreign key. Clearing a bot's memory deletes its row, so an undo
 * never brings cleared facts back.
 */
export class AddBotMemoryDreams1794040957267 implements MigrationInterface {
  name = 'AddBotMemoryDreams1794040957267';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE bot_memory_dream (
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "triedAt" timestamptz NOT NULL DEFAULT now(),
        "requestedAt" timestamptz,
        id uuid,
        "factsBefore" integer,
        "factsAfter" integer,
        note varchar(300),
        snapshot jsonb,
        "outputFactIds" uuid[],
        "createdAt" timestamptz,
        "undoneAt" timestamptz,
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_memory_dream" PRIMARY KEY ("organizationId", "botId"),
        CONSTRAINT "UQ_bot_memory_dream_id" UNIQUE (id),
        CONSTRAINT "CHK_bot_memory_dream_applied" CHECK (num_nonnulls(id, "factsBefore", "factsAfter", snapshot, "outputFactIds", "createdAt") IN (0, 6)),
        CONSTRAINT "CHK_bot_memory_dream_counts" CHECK ("factsBefore" >= 0 AND "factsAfter" >= 0),
        CONSTRAINT "CHK_bot_memory_dream_note" CHECK (note IS NULL OR char_length(btrim(note)) > 0),
        CONSTRAINT "CHK_bot_memory_dream_snapshot" CHECK (jsonb_typeof(snapshot) = 'array'),
        CONSTRAINT "CHK_bot_memory_dream_undone" CHECK ("undoneAt" IS NULL OR id IS NOT NULL)
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_memory_dream ADD CONSTRAINT "FK_bot_memory_dream_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call DROP CONSTRAINT "CHK_bot_model_call_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review', 'dream'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM bot_model_call WHERE purpose = 'dream'`);
    await queryRunner.query(
      `ALTER TABLE bot_model_call DROP CONSTRAINT "CHK_bot_model_call_purpose"`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_model_call ADD CONSTRAINT "CHK_bot_model_call_purpose" CHECK (purpose IN ('goal_review', 'summary', 'rule_review'))`,
    );
    await queryRunner.query(`DROP TABLE bot_memory_dream`);
  }
}
