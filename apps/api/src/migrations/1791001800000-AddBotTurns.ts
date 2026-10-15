import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots, slice 2 (`product/versions/mvp/25-bots.md` §2–3): the chat.
 *
 * - `bot_turn`: one message of yours and what the bot did with it. Queued
 *   until the bot's turn before it ends, then running on one worker, then
 *   ended. `UQ_bot_turn_running` (partial, on `"botId"`) is the rule that a
 *   bot runs one turn at a time, held by the database so two workers can never
 *   both start one; the worker's claim is conditioned on `queued` as well.
 *   The provider, model and effort are copied from the bot when the message
 *   is sent, so a pick made while it waits does not change it. `error` says
 *   why a failed turn failed, bounded and never a key. `cancelRequestedAt` is
 *   Stop on a running turn, which the worker polls. It goes with its bot.
 * - `bot_message`: what the chat draws — your message, the bot's text, an
 *   activity line of tool calls (`steps`, read whole, never filtered: jsonb).
 *   `position` orders a turn's messages. It goes with its turn.
 * - `bot."lastMessageAt"` and `"lastMessagePreview"`: the sidebar's age and
 *   line, written with each message so the list reads no messages.
 *
 * Every child references its parent on `("organizationId", …)`, so nothing
 * points into another workspace. Messages grow with use and go with their bot;
 * no retention job yet (a chat is kept until the bot is deleted).
 *
 * Access patterns and the index that serves each:
 * - a bot's conversation, newest first, bounded: `IDX_bot_message_bot`;
 * - a turn's messages in order: `IDX_bot_message_turn` (also backs the turn FK);
 * - a bot's turns, and the FK from turns to bots: `IDX_bot_turn_bot`;
 * - a bot's active turns and its oldest queued one: `IDX_bot_turn_active`;
 * - one running turn per bot: `UQ_bot_turn_running`;
 * - an account's deletion nulling `requestedByUserId`: `IDX_bot_turn_requested_by`.
 */
export class AddBotTurns1791001800000 implements MigrationInterface {
  name = 'AddBotTurns1791001800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE bot ADD COLUMN "lastMessageAt" timestamp with time zone`);
    await queryRunner.query(
      `ALTER TABLE bot ADD COLUMN "lastMessagePreview" character varying(200)`,
    );
    await queryRunner.query(
      `CREATE TABLE bot_turn (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "requestedByUserId" uuid,
        "status" character varying(16) DEFAULT 'queued' NOT NULL,
        "provider" character varying(16) NOT NULL,
        "model" character varying(128) NOT NULL,
        "effort" character varying(16),
        "error" character varying(1000),
        "inputTokens" integer DEFAULT 0 NOT NULL,
        "outputTokens" integer DEFAULT 0 NOT NULL,
        "cancelRequestedAt" timestamp with time zone,
        "startedAt" timestamp with time zone,
        "endedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_turn" PRIMARY KEY (id),
        CONSTRAINT "UQ_bot_turn_organization_id" UNIQUE ("organizationId", id),
        CONSTRAINT "CHK_bot_turn_status" CHECK ("status" IN ('queued', 'running', 'completed', 'cancelled', 'failed')),
        CONSTRAINT "CHK_bot_turn_provider" CHECK ("provider" IN ('anthropic', 'glm', 'openai')),
        CONSTRAINT "CHK_bot_turn_tokens" CHECK ("inputTokens" >= 0 AND "outputTokens" >= 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_turn_bot" ON bot_turn ("organizationId", "botId", "createdAt", id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_turn_active" ON bot_turn ("organizationId", "botId", "createdAt") WHERE ("status" IN ('queued', 'running'))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_turn_running" ON bot_turn ("botId") WHERE ("status" = 'running')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_turn_requested_by" ON bot_turn ("requestedByUserId") WHERE ("requestedByUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "FK_bot_turn_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_turn ADD CONSTRAINT "FK_bot_turn_requested_by" FOREIGN KEY ("requestedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE bot_message (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "turnId" uuid NOT NULL,
        "role" character varying(16) NOT NULL,
        "content" text DEFAULT '' NOT NULL,
        "steps" jsonb DEFAULT '[]' NOT NULL,
        "position" integer DEFAULT 0 NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_message" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_message_role" CHECK ("role" IN ('user', 'assistant', 'activity')),
        CONSTRAINT "CHK_bot_message_position" CHECK ("position" >= 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_message_bot" ON bot_message ("organizationId", "botId", "createdAt", id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_message_turn" ON bot_message ("organizationId", "turnId", "position")`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_message ADD CONSTRAINT "FK_bot_message_turn" FOREIGN KEY ("organizationId", "turnId") REFERENCES bot_turn("organizationId", id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE bot_message`);
    await queryRunner.query(`DROP TABLE bot_turn`);
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "lastMessagePreview"`);
    await queryRunner.query(`ALTER TABLE bot DROP COLUMN "lastMessageAt"`);
  }
}
