import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bot routines (`product/versions/mvp/26-bot-routines.md` §3–§4): an
 * automation whose run is a turn of a bot rather than a session on a host.
 *
 * - `automation."runTarget"`: `session` or `bot`, what its runs start. It
 *   never changes over an automation's life, so it is on the automation and
 *   not the revision. Default `session`, so every existing row keeps meaning
 *   what it meant.
 * - `automation."botId"`: the bot a routine wakes, set exactly when the
 *   target is `bot` (`CHK_automation_bot_target`). Composite on
 *   `("organizationId", …)` like every bot reference, and `ON DELETE
 *   CASCADE`: a bot's routines go with it.
 * - `automation."projectId"` nullable: a bot's routine (its heartbeat)
 *   belongs to no project and must not be deleted with an unrelated one. A
 *   session automation still needs one (`CHK_automation_session_project`).
 * - `automation."credentialScopes"`: the scopes of the credential that
 *   saved a routine; null for a browser session. Its turns get no more
 *   than those, as a message's turn does (25 §2). Read whole.
 * - `automation_revision` session fields nullable: a bot routine's revision
 *   is its prompt, and it runs on the bot's provider, model and effort as
 *   they are at the run. `CHK_automation_revision_session` keeps host and
 *   agent set or unset together; which a revision needs is the automation's
 *   target, which a CHECK cannot read across tables, so the domain holds it.
 * - `automation_run."botTurnId"`: the turn a bot routine's run queued,
 *   beside `"sessionId"`, never both (`CHK_automation_run_dispatch`). `ON
 *   DELETE SET NULL`: clearing a bot's history keeps the run, as deleting a
 *   session does.
 * - `bot_turn."origin"`: why a turn exists (`message`, `approval`,
 *   `routine`), so the chat and the runs list tell them apart without
 *   reading messages. Default `message`, what every existing turn was.
 * - `bot_turn."sourceKey"`: what makes a routine's turn happen once
 *   (`automation-run:<runId>`): a run dispatched twice finds the turn the
 *   first dispatch queued. Unique per bot among the turns that have one.
 *
 * Access patterns and the index that serves each:
 * - a bot's routines (the Routines tab, `update_routine list`):
 *   `IDX_automation_bot`, partial on the rows that have a bot; it also
 *   serves the bot's deletion cascading to them;
 * - the turn a source key already queued: `UQ_bot_turn_source`;
 * - a turn's deletion nulling the run that queued it: `IDX_automation_run_bot_turn`.
 */
export class AddBotRoutines1791003000000 implements MigrationInterface {
  name = 'AddBotRoutines1791003000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE automation ADD COLUMN "runTarget" character varying(16) NOT NULL DEFAULT 'session'`,
    );
    await queryRunner.query(`ALTER TABLE automation ADD COLUMN "botId" uuid`);
    await queryRunner.query(`ALTER TABLE automation ADD COLUMN "credentialScopes" jsonb`);
    await queryRunner.query(`ALTER TABLE automation ALTER COLUMN "projectId" DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_run_target" CHECK ("runTarget" IN ('session', 'bot'))`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_bot_target" CHECK (("runTarget" = 'bot') = ("botId" IS NOT NULL))`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_session_project" CHECK ("runTarget" = 'bot' OR "projectId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "CHK_automation_credential_scopes" CHECK ("credentialScopes" IS NULL OR jsonb_typeof("credentialScopes") = 'array')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_bot" ON automation USING btree ("organizationId", "botId") WHERE ("botId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE automation ADD CONSTRAINT "FK_automation_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );

    await queryRunner.query(`ALTER TABLE automation_revision ALTER COLUMN "hostId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE automation_revision ALTER COLUMN agent DROP NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE automation_revision ALTER COLUMN repositories SET DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision DROP CONSTRAINT "CHK_automation_revision_repositories"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision ADD CONSTRAINT "CHK_automation_revision_repositories" CHECK (jsonb_typeof(repositories) = 'array' AND ("hostId" IS NULL OR jsonb_array_length(repositories) >= 1))`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision ADD CONSTRAINT "CHK_automation_revision_session" CHECK (("hostId" IS NULL) = (agent IS NULL))`,
    );

    await queryRunner.query(`ALTER TABLE automation_run ADD COLUMN "botTurnId" uuid`);
    await queryRunner.query(
      `ALTER TABLE automation_run ADD CONSTRAINT "CHK_automation_run_dispatch" CHECK (num_nonnulls("sessionId", "botTurnId") <= 1)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_automation_run_bot_turn" ON automation_run USING btree ("organizationId", "botTurnId") WHERE ("botTurnId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_run ADD CONSTRAINT "FK_automation_run_bot_turn" FOREIGN KEY ("organizationId", "botTurnId") REFERENCES bot_turn("organizationId", id) ON DELETE SET NULL ("botTurnId")`,
    );

    await queryRunner.query(
      `ALTER TABLE bot_turn ADD COLUMN origin character varying(16) NOT NULL DEFAULT 'message'`,
    );
    await queryRunner.query(`ALTER TABLE bot_turn ADD COLUMN "sourceKey" character varying(128)`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'routine'))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_turn_source" ON bot_turn USING btree ("botId", "sourceKey") WHERE ("sourceKey" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_bot_turn_source"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "sourceKey"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN origin`);

    await queryRunner.query(
      `ALTER TABLE automation_run DROP CONSTRAINT "FK_automation_run_bot_turn"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_automation_run_bot_turn"`);
    await queryRunner.query(
      `ALTER TABLE automation_run DROP CONSTRAINT "CHK_automation_run_dispatch"`,
    );
    await queryRunner.query(`ALTER TABLE automation_run DROP COLUMN "botTurnId"`);

    // Bot routines have no session to fall back to: they go, with their runs.
    await queryRunner.query(`DELETE FROM automation WHERE "runTarget" = 'bot'`);
    await queryRunner.query(
      `ALTER TABLE automation_revision DROP CONSTRAINT "CHK_automation_revision_session"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision DROP CONSTRAINT "CHK_automation_revision_repositories"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision ADD CONSTRAINT "CHK_automation_revision_repositories" CHECK (((jsonb_typeof(repositories) = 'array'::text) AND (jsonb_array_length(repositories) >= 1)))`,
    );
    await queryRunner.query(
      `ALTER TABLE automation_revision ALTER COLUMN repositories DROP DEFAULT`,
    );
    await queryRunner.query(`ALTER TABLE automation_revision ALTER COLUMN agent SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE automation_revision ALTER COLUMN "hostId" SET NOT NULL`);

    await queryRunner.query(`ALTER TABLE automation DROP CONSTRAINT "FK_automation_bot"`);
    await queryRunner.query(`DROP INDEX "IDX_automation_bot"`);
    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_credential_scopes"`,
    );
    await queryRunner.query(
      `ALTER TABLE automation DROP CONSTRAINT "CHK_automation_session_project"`,
    );
    await queryRunner.query(`ALTER TABLE automation DROP CONSTRAINT "CHK_automation_bot_target"`);
    await queryRunner.query(`ALTER TABLE automation DROP CONSTRAINT "CHK_automation_run_target"`);
    await queryRunner.query(`ALTER TABLE automation ALTER COLUMN "projectId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE automation DROP COLUMN "credentialScopes"`);
    await queryRunner.query(`ALTER TABLE automation DROP COLUMN "botId"`);
    await queryRunner.query(`ALTER TABLE automation DROP COLUMN "runTarget"`);
  }
}
