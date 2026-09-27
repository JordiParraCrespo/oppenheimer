import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A session's **turns**, and where a session came from
 * (`product/versions/mvp/16-automations-architecture.md` §Q4).
 *
 * A turn is one prompt given to the agent and what became of it: queued, in
 * progress, waiting on a person, completed, failed, cancelled or expired —
 * OpenAI's run states, because a turn is exactly their run. A session is the
 * thread; its turns are the runs on it. An automation's run is the first turn
 * of the session it started, and "Continue this run" is the next one.
 *
 * **A projection, like every column on `work_session`.** The rows are folded
 * from `work_session_event` inside the transaction that appends the events
 * (`session-turn.policy.ts`), so a turn is never eventually-consistent with its
 * own log and a replay rebuilds it. That is why it is a table of the sessions
 * module rather than of automations: execution is the session's, whoever asked
 * for it, and a person's headless session later reads the same rows.
 *
 * Access patterns:
 *
 *   Q1  the turns of one session, in order         → UQ ("sessionId", "seq")
 *   Q2  the latest turn of one session              → the same, scanned backwards
 *   Q3  an automation's runs joined to their turn   → Q1 on ("sessionId", 1)
 *   Q4  headless turns running on a host (capacity) → a count by the session's
 *       host; the row is narrow and the live set is small, so it rides the
 *       session index and `IDX_session_turn_live`
 *
 * `organizationId` is carried and leads the composite foreign key, so a turn
 * can never point into another workspace's session. `prompt` is the rendered
 * prompt the agent was given — for an automation, its instructions plus the
 * event's untrusted context — so a run page shows exactly what the agent saw.
 * `costUsd` is the agent's own client-side estimate and is shown as one.
 *
 * `work_session.origin` says who asked for the session: a person, or an
 * automation (whose `automation_run.sessionId` points back at it). It is a
 * column rather than a log entry because the sidebar filters on it.
 *
 * Retention: turns live as long as their session, which is never hard-deleted
 * outside erasing a workspace.
 */
export class AddSessionTurns1790400000000 implements MigrationInterface {
  name = 'AddSessionTurns1790400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "work_session"
         ADD COLUMN "origin" varchar(16) NOT NULL DEFAULT 'person',
         ADD CONSTRAINT "CHK_work_session_origin" CHECK ("origin" IN ('person', 'automation'))`,
    );

    await queryRunner.query(
      `CREATE TABLE "session_turn" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "seq" integer NOT NULL,
        "origin" varchar(16) NOT NULL,
        "drive" varchar(16) NOT NULL DEFAULT 'interactive',
        "state" varchar(20) NOT NULL DEFAULT 'queued',
        "prompt" text,
        "observedWorking" boolean NOT NULL DEFAULT false,
        "startedAt" timestamptz,
        "endedAt" timestamptz,
        "exitCode" integer,
        "agentSessionId" varchar(128),
        "result" text,
        "failureDetail" text,
        "costUsd" numeric(12, 6),
        "permissionDenials" integer NOT NULL DEFAULT 0,
        "outputRef" varchar(512),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session_turn" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_session_turn_session_seq" UNIQUE ("sessionId", "seq"),
        CONSTRAINT "FK_session_turn_session"
          FOREIGN KEY ("organizationId", "sessionId")
          REFERENCES "work_session" ("organizationId", "id") ON DELETE CASCADE,
        CONSTRAINT "CHK_session_turn_seq" CHECK ("seq" >= 1),
        CONSTRAINT "CHK_session_turn_origin"
          CHECK ("origin" IN ('person', 'automation', 'follow_up')),
        CONSTRAINT "CHK_session_turn_drive" CHECK ("drive" IN ('interactive', 'headless')),
        CONSTRAINT "CHK_session_turn_state" CHECK ("state" IN
          ('queued', 'in_progress', 'requires_action', 'completed', 'failed', 'cancelled', 'expired')),
        CONSTRAINT "CHK_session_turn_ended"
          CHECK ("endedAt" IS NULL OR "startedAt" IS NULL OR "endedAt" >= "startedAt"),
        CONSTRAINT "CHK_session_turn_cost" CHECK ("costUsd" IS NULL OR "costUsd" >= 0),
        CONSTRAINT "CHK_session_turn_denials" CHECK ("permissionDenials" >= 0)
      )`,
    );
    // The composite key's own index: a session delete (only when a workspace is
    // erased) must not scan turns. `UQ_session_turn_session_seq` leads with
    // "sessionId" but not "organizationId", so it does not serve the key.
    await queryRunner.query(
      `CREATE INDEX "IDX_session_turn_organization_session"
         ON "session_turn" ("organizationId", "sessionId")`,
    );
    // Q4: the live turns, a small subset of a table that only grows.
    await queryRunner.query(
      `CREATE INDEX "IDX_session_turn_live" ON "session_turn" ("sessionId")
         WHERE "state" IN ('queued', 'in_progress', 'requires_action')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_session_turn_live"`);
    await queryRunner.query(`DROP INDEX "IDX_session_turn_organization_session"`);
    await queryRunner.query(`DROP TABLE "session_turn"`);
    await queryRunner.query(
      `ALTER TABLE "work_session" DROP CONSTRAINT "CHK_work_session_origin", DROP COLUMN "origin"`,
    );
  }
}
