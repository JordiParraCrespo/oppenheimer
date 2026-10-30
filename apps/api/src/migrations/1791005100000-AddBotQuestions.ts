import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A bot can stop on questions for its owner (`ask_user`,
 * `product/versions/mvp/25-bots.md` §3.2; from Grok Bot's form cards,
 * `research/lessons-from-grok-bot.md` §9 row 12).
 *
 * - `bot_question`: one card of up to four questions, waiting for the owner.
 *   It is answered or dismissed, never approved, and nothing runs on it, so
 *   it is its own table beside `bot_approval` rather than a kind of approval.
 *   `answers` is set exactly when it was answered.
 * - One card waits per bot, whatever it holds: `UQ_bot_question_pending` is
 *   one question card, and the requester checks for a waiting approval under
 *   the bot's lock (as an approval does for a waiting question).
 * - A decided card opens a turn of its own origin, `question`.
 *
 * Access patterns:
 * - the chat's card: a bot's pending question, `UQ_bot_question_pending`;
 * - a decision: by id within the bot, the primary key;
 * - Clear history deleting a bot's cards: `IDX_bot_question_bot`;
 * - the FK to the asking turn: `IDX_bot_question_turn`;
 * - an account's deletion nulling `decidedByUserId`: `IDX_bot_question_decided_by`.
 */
export class AddBotQuestions1791005100000 implements MigrationInterface {
  name = 'AddBotQuestions1791005100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE bot_question (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "turnId" uuid NOT NULL,
        questions jsonb NOT NULL,
        summary varchar(500) NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending',
        answers jsonb,
        note varchar(1000),
        "decidedByUserId" uuid,
        "decidedWithScopes" jsonb,
        "decidedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bot_question" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_question_status" CHECK (status IN ('pending', 'answered', 'dismissed', 'expired')),
        CONSTRAINT "CHK_bot_question_questions" CHECK (jsonb_typeof(questions) = 'array' AND jsonb_array_length(questions) BETWEEN 1 AND 4),
        CONSTRAINT "CHK_bot_question_summary" CHECK (char_length(summary) > 0),
        CONSTRAINT "CHK_bot_question_answers" CHECK ((status = 'answered') = (answers IS NOT NULL)),
        CONSTRAINT "CHK_bot_question_decided" CHECK ((status = 'pending') = ("decidedAt" IS NULL))
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_question_pending" ON bot_question ("botId") WHERE (status = 'pending')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_question_bot" ON bot_question ("organizationId", "botId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_question_turn" ON bot_question ("organizationId", "turnId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_question_decided_by" ON bot_question ("decidedByUserId") WHERE ("decidedByUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_question ADD CONSTRAINT "FK_bot_question_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_question ADD CONSTRAINT "FK_bot_question_turn" FOREIGN KEY ("organizationId", "turnId") REFERENCES bot_turn("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_question ADD CONSTRAINT "FK_bot_question_decided_by" FOREIGN KEY ("decidedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );

    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'question', 'routine', 'subscription', 'goal'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A decided card's turn stays, as an approval's: it ran for the bot.
    await queryRunner.query(`UPDATE bot_turn SET origin = 'approval' WHERE origin = 'question'`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_origin"`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_origin" CHECK (origin IN ('message', 'approval', 'routine', 'subscription', 'goal'))`,
    );
    await queryRunner.query(`DROP TABLE bot_question`);
  }
}
