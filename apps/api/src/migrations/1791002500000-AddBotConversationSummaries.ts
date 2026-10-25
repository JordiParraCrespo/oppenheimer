import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots: long conversations (`product/versions/mvp/25-bots.md` §2).
 *
 * A turn used to be sent the bot's last 40 messages and nothing older. It is
 * now sent a token budget of history: the conversation's summary, then the
 * newest messages after the summary's cutoff that fit. When the messages the
 * summary does not cover pass the budget with headroom, a job on the
 * `bot-summaries` queue folds the oldest of them into the summary, with the
 * bot's own provider, model and key. The messages themselves are untouched:
 * the chat still reads all of them; only what the model is sent changes.
 *
 * - `bot_conversation_summary`: one row per bot, keyed by the bot's
 *   `("organizationId", "botId")`, which is also the composite foreign key
 *   to `bot` (`ON DELETE CASCADE`: a summary means nothing without its bot,
 *   and a key that leads with the workspace means it can never name another
 *   workspace's bot). The primary key's index backs that foreign key.
 *   - `content` is the summary, bounded (`varchar(12000)`, about 3,000
 *     tokens) and never empty.
 *   - `coversThroughMessageId` is the newest message the summary covers,
 *     and `coversThroughCreatedAt` that message's `createdAt`, copied from
 *     the message row by the write itself (an `INSERT … SELECT`, an `UPDATE
 *     … FROM bot_message`), so the cutoff keeps the database's microseconds
 *     and a turn's history (`"createdAt" > cutoff`) never re-reads the last
 *     message folded. The write picks the message within the same workspace
 *     and bot. The foreign key to `bot_message` cascades (a summary is never
 *     left pointing at nothing), backed by `IDX_bot_conversation_summary_message`.
 *   - `version` counts writes. Every write after the first is
 *     `UPDATE … WHERE "version" = $loaded AND <new cutoff> > "coversThroughCreatedAt"`,
 *     and the first is `INSERT … ON CONFLICT DO NOTHING`: of two summarizing
 *     jobs that race, one wins and the other writes nothing, and the cutoff
 *     never moves backwards.
 *
 * Access patterns and the index that serves each:
 * - a turn's read, and the summarizer's, of a bot's summary: `PK_bot_conversation_summary`;
 * - the FK to bots, and the cascade from a bot's deletion: the same key;
 * - a message's deletion checking for a summary that names it:
 *   `IDX_bot_conversation_summary_message`.
 * One row per bot, rewritten in place: no retention needed.
 */
export class AddBotConversationSummaries1791002500000 implements MigrationInterface {
  name = 'AddBotConversationSummaries1791002500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE bot_conversation_summary (
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "content" character varying(12000) NOT NULL,
        "coversThroughMessageId" uuid NOT NULL,
        "coversThroughCreatedAt" timestamp with time zone NOT NULL,
        "version" integer DEFAULT 1 NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_conversation_summary" PRIMARY KEY ("organizationId", "botId"),
        CONSTRAINT "CHK_bot_conversation_summary_content" CHECK (char_length("content") > 0),
        CONSTRAINT "CHK_bot_conversation_summary_version" CHECK ("version" >= 1)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_conversation_summary_message" ON bot_conversation_summary ("coversThroughMessageId")`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation_summary ADD CONSTRAINT "FK_bot_conversation_summary_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_conversation_summary ADD CONSTRAINT "FK_bot_conversation_summary_message" FOREIGN KEY ("coversThroughMessageId") REFERENCES bot_message(id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bot_conversation_summary`);
  }
}
