import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots that message bots (`product/versions/mvp/25-bots.md` §4.6,
 * `message_bot` and `ask_bot`): a turn another bot's tool call queued, its
 * lane, the chain it belongs to, and the answer an ask owes.
 *
 * - `bot_turn."lane"`: `owner` (yours, and an approval's report), `bots`
 *   (sent by another bot, or the answer to an ask), `background`. The next
 *   turn due is the oldest of the first lane that has one
 *   (`BotQueueLanes`). Every existing turn is an owner turn.
 * - `bot_turn."chainId"` and `"chainDepth"`: a chain starts at one of your
 *   messages; every turn a bot queues because of it carries the id of that
 *   first turn and how many bots deep it is. A correlation id, not a
 *   reference: the first turn may be cleared from its bot's chat while the
 *   chain finishes, and the chain's count must not move when it is. Null and
 *   0 on an owner turn.
 * - `bot_turn."askedByBotId"`, `"askedByTurnId"`: the bot and the turn whose
 *   call queued this one, as Oppenheimer recorded them, never a name the
 *   message claims. Composite on `("organizationId", …)` like every other bot
 *   reference, so a bot is only ever messaged by a bot of its own workspace;
 *   deleting the sender, or clearing its chat, only loses the link
 *   (`ON DELETE SET NULL (column)`, Postgres 15+).
 * - `bot_turn."replyRequested"`: sent with `ask_bot`; when the turn ends, its
 *   answer is queued as a turn of the asker.
 * - `bot_turn."answersTurnId"`: on that answer's turn, the turn it answers.
 *   Unique per workspace among the rows that have one, so a delivery job
 *   retried after a crash queues the answer once.
 *
 * Access patterns and the index that serves each:
 * - the bots and the asks of one chain, read under the lock on its first
 *   turn before another ask is queued: `IDX_bot_turn_chain`, partial;
 * - the answer already queued for a turn (a retried delivery):
 *   `UQ_bot_turn_answers`;
 * - a sender's deletion or a cleared chat nulling the links (the FKs'
 *   referencing side): `IDX_bot_turn_asked_by_bot`, `IDX_bot_turn_asked_by_turn`,
 *   and `UQ_bot_turn_answers` for `answersTurnId`, all partial;
 * - the next turn due: `IDX_bot_turn_active`, unchanged; a bot has a handful
 *   of active turns, so the lane is sorted in memory.
 */
export class AddBotPeerMessages1791002600000 implements MigrationInterface {
  name = 'AddBotPeerMessages1791002600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD COLUMN "lane" character varying(16) NOT NULL DEFAULT 'owner'`,
    );
    await queryRunner.query(`ALTER TABLE bot_turn ADD COLUMN "chainId" uuid`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD COLUMN "chainDepth" smallint NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE bot_turn ADD COLUMN "askedByBotId" uuid`);
    await queryRunner.query(`ALTER TABLE bot_turn ADD COLUMN "askedByTurnId" uuid`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD COLUMN "replyRequested" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE bot_turn ADD COLUMN "answersTurnId" uuid`);
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_lane" CHECK ("lane" IN ('owner', 'bots', 'background'))`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "CHK_bot_turn_chain_depth" CHECK ("chainDepth" >= 0)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_turn_chain" ON bot_turn USING btree ("organizationId", "chainId") WHERE ("chainId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_turn_answers" ON bot_turn USING btree ("organizationId", "answersTurnId") WHERE ("answersTurnId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_turn_asked_by_bot" ON bot_turn USING btree ("organizationId", "askedByBotId") WHERE ("askedByBotId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_turn_asked_by_turn" ON bot_turn USING btree ("organizationId", "askedByTurnId") WHERE ("askedByTurnId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "FK_bot_turn_asked_by_bot" FOREIGN KEY ("organizationId", "askedByBotId") REFERENCES bot("organizationId", id) ON DELETE SET NULL ("askedByBotId")`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "FK_bot_turn_asked_by_turn" FOREIGN KEY ("organizationId", "askedByTurnId") REFERENCES bot_turn("organizationId", id) ON DELETE SET NULL ("askedByTurnId")`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "FK_bot_turn_answers_turn" FOREIGN KEY ("organizationId", "answersTurnId") REFERENCES bot_turn("organizationId", id) ON DELETE SET NULL ("answersTurnId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "FK_bot_turn_answers_turn"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "FK_bot_turn_asked_by_turn"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "FK_bot_turn_asked_by_bot"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_turn_asked_by_turn"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_turn_asked_by_bot"`);
    await queryRunner.query(`DROP INDEX "UQ_bot_turn_answers"`);
    await queryRunner.query(`DROP INDEX "IDX_bot_turn_chain"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_chain_depth"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP CONSTRAINT "CHK_bot_turn_lane"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "answersTurnId"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "replyRequested"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "askedByTurnId"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "askedByBotId"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "chainDepth"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "chainId"`);
    await queryRunner.query(`ALTER TABLE bot_turn DROP COLUMN "lane"`);
  }
}
