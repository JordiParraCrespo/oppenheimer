import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `/loop`, a prompt a bot runs again and again (`product/versions/mvp/25-bots.md`
 * §4.1, "Built-in commands"; from Claude Code's `/loop`).
 *
 * - `bot_loop`: one row per bot at most (`UQ_bot_loop_bot`), the loop open
 *   now. A run is not stored here: it is a queued `bot_turn` of origin
 *   `loop` whose `"sourceKey"` names the loop and its number, as a goal's
 *   continuation is, so `UQ_bot_turn_source` makes a run dispatched twice
 *   one turn. `"runs"` counts the runs queued after the first (the message
 *   that set it), and is what a run is claimed on, so two dispatches of one
 *   run queue one.
 * - `"intervalMinutes"` is the interval, 1 minute to 1 day; null when the
 *   loop is self-paced and the bot says when it runs next.
 * - `"nextRunAt"` is when the next run is due: the delayed job that runs it
 *   carries the same time, and a job whose time is no longer the loop's (the
 *   bot moved it, a skip moved it) does nothing. Null while a self-paced
 *   loop waits for its run to say when.
 * - `"expiresAt"` bounds it: 3 days after it was set, the run due then
 *   ends it instead. There is no sweep: every loop has a job due at or
 *   before its expiry.
 * - An ended loop is deleted, not kept with a status: how it ended is a line
 *   in the chat, so there is no retention to plan.
 * - `"originTurnId"` is the turn that set it, which the end of that first run
 *   is told apart by. `CASCADE`: clearing the chat clears its loop, as it
 *   does a goal.
 * - `"credentialScopes"` and `"timeZone"` are the setting turn's: a run
 *   reaches no further than the message that set it.
 *
 * Access patterns:
 * - a run, a turn's end, the tools and the console: a bot's loop,
 *   `UQ_bot_loop_bot`, which also backs the bot foreign key;
 * - clearing a chat: `IDX_bot_loop_origin_turn` backs that key.
 */
export class AddBotLoops1793709569630 implements MigrationInterface {
  name = 'AddBotLoops1793709569630';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bot_loop (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "originTurnId" uuid NOT NULL,
        prompt varchar(2000) NOT NULL,
        "intervalMinutes" integer,
        runs integer NOT NULL DEFAULT 0,
        "nextRunAt" timestamptz,
        "expiresAt" timestamptz NOT NULL,
        "credentialScopes" jsonb,
        "timeZone" varchar(64),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_loop" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_loop_prompt" CHECK (char_length(prompt) > 0),
        CONSTRAINT "CHK_bot_loop_interval" CHECK ("intervalMinutes" IS NULL OR "intervalMinutes" BETWEEN 1 AND 1440),
        CONSTRAINT "CHK_bot_loop_runs" CHECK (runs >= 0),
        CONSTRAINT "CHK_bot_loop_expires" CHECK (isfinite("expiresAt") AND "expiresAt" - "createdAt" <= interval '3 days 1 minute'),
        CONSTRAINT "CHK_bot_loop_credential_scopes" CHECK ("credentialScopes" IS NULL OR jsonb_typeof("credentialScopes") = 'array')
      )
    `);
    await queryRunner.query(
      `ALTER TABLE bot_loop ADD CONSTRAINT "FK_bot_loop_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_loop ADD CONSTRAINT "FK_bot_loop_origin_turn" FOREIGN KEY ("organizationId", "originTurnId") REFERENCES bot_turn("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_loop_bot" ON bot_loop ("organizationId", "botId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_loop_origin_turn" ON bot_loop ("organizationId", "originTurnId")`,
    );

    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal', 'loop'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A run's turn stays, as a goal's continuation's would: it ran for the bot.
    await queryRunner.query(`UPDATE bot_turn SET origin = 'routine' WHERE origin = 'loop'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal'))`,
    );
    await queryRunner.query(`DROP TABLE bot_loop`);
  }
}
