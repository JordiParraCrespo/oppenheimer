import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot's skills (`product/versions/mvp/25-bots.md` §4.1; from OpenClaw's
 * `SKILL.md` and Grok Bot's saved skills,
 * `research/lessons-from-openclaw-and-grok-bot-skills.md`): one row per skill,
 * a short name that is also its slash command, a description every turn's
 * prompt lists, and the body the bot reads when it uses it. Capped per bot by
 * the API (`BOT_SKILLS_MAX`), counted under a lock on the bot's row, as its
 * memory is.
 *
 * - `userInvocable`: the person may run it as `/<name>` (OpenClaw's
 *   `user-invocable`).
 * - `modelInvocable`: the prompt lists it, so the bot may use it unasked (the
 *   inverse of OpenClaw's `disable-model-invocation`).
 * - `source`: who wrote it last, a person in Settings or the bot itself.
 *
 * Access patterns: a bot's skills by name (the prompt's list, Settings, and
 * the one a slash command or `use_skill` names), and a name taken:
 * `UQ_bot_skill_name`. The key references the bot on `("organizationId", id)`,
 * so a skill cannot point into another workspace, and goes with the bot.
 */
export class AddBotSkills1791005700000 implements MigrationInterface {
  name = 'AddBotSkills1791005700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE bot_skill (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        name character varying(32) NOT NULL,
        description character varying(280) NOT NULL,
        body text NOT NULL,
        "userInvocable" boolean DEFAULT true NOT NULL,
        "modelInvocable" boolean DEFAULT true NOT NULL,
        source character varying(8) DEFAULT 'user' NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_skill" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_skill_name" CHECK (name ~ '^[a-z0-9][a-z0-9-]{0,31}$'),
        CONSTRAINT "CHK_bot_skill_description" CHECK (char_length(btrim(description)) > 0),
        CONSTRAINT "CHK_bot_skill_body" CHECK (char_length(btrim(body)) > 0 AND char_length(body) <= 10000),
        CONSTRAINT "CHK_bot_skill_source" CHECK (source IN ('user', 'bot'))
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_skill_name" ON bot_skill ("organizationId", "botId", name)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_skill ADD CONSTRAINT "FK_bot_skill_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bot_skill`);
  }
}
