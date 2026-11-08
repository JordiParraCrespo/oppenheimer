import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What a person writes about themselves for their bots (Settings → Memory,
 * `product/versions/mvp/25-bots.md` §4.1): one text per person per
 * workspace, in the system prompt of every bot they made there. The bots
 * read it and never write it, so it is not a `bot_memory_fact`: those are
 * the bot's own rows, under its cap and its lock, and go with the bot.
 *
 * - One row per member: the key is `("organizationId", "userId")`, with no
 *   surrogate. A person with nothing written has no row.
 * - Both foreign keys cascade: the text means nothing without the
 *   workspace or the account. `IDX_person_memory_user` backs the one to
 *   `user`; the key backs the one to `organization`.
 * - `about` is capped by a `CHECK` as well as the API, like
 *   `bot_document.content`.
 *
 * Left out: revisions (the bots' documents keep them; this is a short note
 * its writer rewrites), and facts a person adds by hand one at a time,
 * which the text covers.
 */
export class AddPersonMemory1794044900508 implements MigrationInterface {
  name = 'AddPersonMemory1794044900508';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS person_memory (
        "organizationId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        about text DEFAULT '' NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_person_memory" PRIMARY KEY ("organizationId", "userId"),
        CONSTRAINT "CHK_person_memory_about" CHECK (char_length(about) <= 4000),
        CONSTRAINT "FK_person_memory_organization" FOREIGN KEY ("organizationId") REFERENCES organization(id) ON DELETE CASCADE,
        CONSTRAINT "FK_person_memory_user" FOREIGN KEY ("userId") REFERENCES "user"(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_person_memory_user" ON person_memory ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_person_memory_user"`);
    await queryRunner.query(`DROP TABLE IF EXISTS person_memory`);
  }
}
