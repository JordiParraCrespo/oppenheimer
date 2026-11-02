import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A goal a bot sets itself keeps it going (`product/versions/mvp/25-bots.md`
 * §4.1; from Grok Bot's goals, `research/lessons-from-grok-bot.md` §9 row
 * 10).
 *
 * - `bot_goal`: one row per bot at most (`UQ_bot_goal_bot`), the goal open
 *   now. A continuation is not stored here: it is a queued `bot_turn` whose
 *   `"sourceKey"` names the goal and its number, so the turn queue stays the
 *   one record of what a bot was woken for and `UQ_bot_turn_source` makes a
 *   turn's end delivered twice one continuation. `"continuations"` counts
 *   them against `"limit"`, and is the condition a continuation is claimed
 *   on, so two ends at once queue one.
 * - An ended goal is deleted, not kept with a status: how it ended is a line
 *   in the chat, which is what anyone reads afterwards, so there is no
 *   retention to plan.
 * - `"originTurnId"` is the turn that set it, which a continuation's failure
 *   is told apart by. `CASCADE`: clearing the chat clears its goal, since a
 *   continuation reads a history that no longer exists.
 * - `"credentialScopes"` and `"timeZone"` are the setting turn's, as a
 *   subscription keeps them: a continuation reaches no further than the
 *   message that led to it.
 *
 * Access patterns:
 * - a turn's end, the tools and the console: a bot's goal,
 *   `UQ_bot_goal_bot`, which also backs the bot foreign key;
 * - clearing a chat: `IDX_bot_goal_origin_turn` backs that key.
 */
export class AddBotGoals1791004900000 implements MigrationInterface {
  name = 'AddBotGoals1791004900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bot_goal (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "originTurnId" uuid NOT NULL,
        objective varchar(500) NOT NULL,
        "limit" integer NOT NULL,
        continuations integer NOT NULL DEFAULT 0,
        "credentialScopes" jsonb,
        "timeZone" varchar(64),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_goal" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_goal_objective" CHECK (char_length(objective) > 0),
        CONSTRAINT "CHK_bot_goal_limit" CHECK ("limit" BETWEEN 1 AND 10),
        CONSTRAINT "CHK_bot_goal_continuations" CHECK (continuations BETWEEN 0 AND "limit"),
        CONSTRAINT "CHK_bot_goal_credential_scopes" CHECK ("credentialScopes" IS NULL OR jsonb_typeof("credentialScopes") = 'array')
      )
    `);
    await queryRunner.query(
      `ALTER TABLE bot_goal ADD CONSTRAINT "FK_bot_goal_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_goal ADD CONSTRAINT "FK_bot_goal_origin_turn" FOREIGN KEY ("organizationId", "originTurnId") REFERENCES bot_turn("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_goal_bot" ON bot_goal ("organizationId", "botId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_goal_origin_turn" ON bot_goal ("organizationId", "originTurnId")`,
    );

    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'routine', 'subscription', 'goal'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A continuation's turn stays, as a routine's would: it ran for the bot.
    await queryRunner.query(`UPDATE bot_turn SET origin = 'routine' WHERE origin = 'goal'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'routine', 'subscription'))`,
    );
    await queryRunner.query(`DROP TABLE bot_goal`);
  }
}
