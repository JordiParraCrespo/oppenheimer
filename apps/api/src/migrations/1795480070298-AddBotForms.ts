import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot can stop on a form for its owner to fill (`ask_form`): a title, a
 * line on what it is for, one to eight typed fields and the button's word.
 *
 * - `bot_form`: one form, waiting for the owner. Like a card of questions it
 *   is submitted or dismissed, never approved, and nothing runs on it, so it
 *   is a table of its own beside `bot_question` rather than a kind of one:
 *   its spec and its values have another shape. `spec` is the form as the
 *   bot asked it, read whole (`jsonb`); `values` is a value per field id,
 *   set exactly when it was submitted.
 * - One card waits per bot, whatever it holds: `UQ_bot_form_pending` is one
 *   form, and the requester checks for a waiting approval or questions under
 *   the bot's lock (as they now do for a waiting form).
 * - A decided form opens a turn of origin `question`, the turn a card the
 *   person answered opens, so `CHK_bot_turn_origin` does not change.
 *
 * Access patterns:
 * - the chat's card: a bot's pending form, `UQ_bot_form_pending`;
 * - a decision: by id within the bot, the primary key;
 * - Clear history deleting a bot's forms: `IDX_bot_form_bot`;
 * - the FK to the asking turn: `IDX_bot_form_turn`;
 * - an account's deletion nulling `decidedByUserId`: `IDX_bot_form_decided_by`.
 *
 * Retention: a form lives as long as its turn and its bot (both cascade), and
 * Clear history deletes them; one bot has at most a handful.
 */
export class AddBotForms1795480070298 implements MigrationInterface {
  name = 'AddBotForms1795480070298';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bot_form (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "turnId" uuid NOT NULL,
        spec jsonb NOT NULL,
        summary varchar(120) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending',
        "values" jsonb,
        note varchar(1000),
        "decidedByUserId" uuid,
        "decidedWithScopes" jsonb,
        "decidedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_form" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_form_status" CHECK (status IN ('pending', 'submitted', 'dismissed', 'expired')),
        CONSTRAINT "CHK_bot_form_spec" CHECK (jsonb_typeof(spec) = 'object'),
        CONSTRAINT "CHK_bot_form_summary" CHECK (char_length(summary) > 0),
        CONSTRAINT "CHK_bot_form_values" CHECK ((status = 'submitted') = ("values" IS NOT NULL)),
        CONSTRAINT "CHK_bot_form_decided" CHECK ((status = 'pending') = ("decidedAt" IS NULL))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_form_pending" ON bot_form ("botId") WHERE (status = 'pending')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_form_bot" ON bot_form ("organizationId", "botId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_form_turn" ON bot_form ("organizationId", "turnId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_form_decided_by" ON bot_form ("decidedByUserId") WHERE ("decidedByUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_form ADD CONSTRAINT "FK_bot_form_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_form ADD CONSTRAINT "FK_bot_form_turn" FOREIGN KEY ("organizationId", "turnId") REFERENCES bot_turn("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_form ADD CONSTRAINT "FK_bot_form_decided_by" FOREIGN KEY ("decidedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A decided form's turn stays, as a card of questions' does: it ran for the bot.
    await queryRunner.query(`DROP TABLE bot_form`);
  }
}
