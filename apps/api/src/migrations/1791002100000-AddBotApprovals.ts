import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bots, slice 3 (`product/versions/mvp/25-bots.md` §5): the Needs input card.
 *
 * - `bot_approval`: one call of an asking tool (`start_session`, …) that a
 *   turn made under Approve for me and that waits for the bot's owner. The
 *   turn does not wait on it: the tool records the row, tells the model to
 *   end its turn, and the turn ends. A decision is a request of its own: a
 *   yes runs the stored call as the owner and queues a turn that tells the
 *   bot what happened, a no queues one that tells it not to. So no worker is
 *   held across a person's time, and a deploy loses nothing.
 *   - `input` is the call exactly as the tool validated it: what runs on a
 *     yes, and nothing else. It is read whole, never filtered (jsonb).
 *   - `summary` is what the card says, written by the tool from the input
 *     (bounded: a sentence, never the whole task).
 *   - `status` moves from `pending` once: to `approved` (then `failed` if the
 *     call failed when it ran), `denied`, or `expired` when the person writes
 *     to the bot instead. Every move is a conditional `UPDATE` on the status
 *     the row was read in, so two clicks never both decide it.
 *   - `UQ_bot_approval_pending` (partial, on `"botId"`): at most one card per
 *     bot waits at a time. A second asking call while one waits is told to
 *     wait, and the database is what holds that if two race.
 *   - `result` is the tool's answer after it ran on a yes (bounded); `note`
 *     what the person added to a no.
 *   - `decidedByUserId` goes null with the account (`SET NULL`), the approval
 *     stays.
 * - `bot_message."role"` admits `event`: what Oppenheimer tells the bot on the
 *   person's behalf (an approval decided, and what the call answered). It
 *   opens the continuation turn as your message opens yours, and the chat
 *   draws it as a small line, not as a bubble from you.
 *
 * Every parent reference is composite on `("organizationId", …)`, so nothing
 * points into another workspace, and an approval goes with its bot and with
 * the turn that asked. Approvals grow by one per asking call; they go with
 * their bot (no retention job yet, as for messages).
 *
 * Access patterns and the index that serves each:
 * - a bot's approvals, newest first, by status or not, and the FK to bots:
 *   `IDX_bot_approval_bot`;
 * - the bot's pending one (the card, the expiry on a new message, the
 *   one-at-a-time rule): `UQ_bot_approval_pending`;
 * - the FK to the turn that asked: `IDX_bot_approval_turn`;
 * - an account's deletion nulling `decidedByUserId`: `IDX_bot_approval_decided_by`.
 */
export class AddBotApprovals1791002100000 implements MigrationInterface {
  name = 'AddBotApprovals1791002100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE bot_approval (
        id uuid DEFAULT gen_random_uuid() NOT NULL,
        "organizationId" uuid NOT NULL,
        "botId" uuid NOT NULL,
        "turnId" uuid NOT NULL,
        "tool" character varying(64) NOT NULL,
        "input" jsonb DEFAULT '{}' NOT NULL,
        "summary" character varying(500) NOT NULL,
        "status" character varying(16) DEFAULT 'pending' NOT NULL,
        "result" character varying(2000),
        "note" character varying(1000),
        "decidedByUserId" uuid,
        "decidedAt" timestamp with time zone,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_bot_approval" PRIMARY KEY (id),
        CONSTRAINT "CHK_bot_approval_status" CHECK ("status" IN ('pending', 'approved', 'denied', 'expired', 'failed')),
        CONSTRAINT "CHK_bot_approval_tool" CHECK (char_length("tool") > 0),
        CONSTRAINT "CHK_bot_approval_summary" CHECK (char_length("summary") > 0),
        CONSTRAINT "CHK_bot_approval_decided" CHECK (("status" = 'pending') = ("decidedAt" IS NULL))
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_approval_bot" ON bot_approval ("organizationId", "botId", "createdAt", id)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_bot_approval_pending" ON bot_approval ("botId") WHERE ("status" = 'pending')`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_approval_turn" ON bot_approval ("organizationId", "turnId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bot_approval_decided_by" ON bot_approval ("decidedByUserId") WHERE ("decidedByUserId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_approval ADD CONSTRAINT "FK_bot_approval_bot" FOREIGN KEY ("organizationId", "botId") REFERENCES bot("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_approval ADD CONSTRAINT "FK_bot_approval_turn" FOREIGN KEY ("organizationId", "turnId") REFERENCES bot_turn("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE bot_approval ADD CONSTRAINT "FK_bot_approval_decided_by" FOREIGN KEY ("decidedByUserId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );
    await queryRunner.query(`ALTER TABLE bot_message DROP CONSTRAINT "CHK_bot_message_role"`);
    await queryRunner.query(
      `ALTER TABLE bot_message ADD CONSTRAINT "CHK_bot_message_role" CHECK ("role" IN ('user', 'assistant', 'activity', 'event'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // An event opened its turn; with the role gone it reads back as the person's.
    await queryRunner.query(`UPDATE bot_message SET "role" = 'user' WHERE "role" = 'event'`);
    await queryRunner.query(`ALTER TABLE bot_message DROP CONSTRAINT "CHK_bot_message_role"`);
    await queryRunner.query(
      `ALTER TABLE bot_message ADD CONSTRAINT "CHK_bot_message_role" CHECK ("role" IN ('user', 'assistant', 'activity'))`,
    );
    await queryRunner.query(`DROP TABLE bot_approval`);
  }
}
