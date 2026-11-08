import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Whether a Claude Code cloud session is idle, so a reply typed in its chat
 * can wake it from the host that started it
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session").
 *
 * - `session_cloud_idle`: one row per cloud session whose Stop hook has
 *   asked for a reply. `idleSince` is set when a hook's wait ended with
 *   nothing to take, which is the session's turn over and nobody answering
 *   in time; it is cleared when a hook starts waiting again, or when a reply
 *   claims the session to wake it (`UPDATE … WHERE "idleSince" IS NOT NULL`,
 *   so two replies at once wake it once, and the second waits for the
 *   woken turn's Stop hook). Null is "working, or a hook is listening".
 * - `wakingSince` is when a reply claimed the mark to wake the session.
 *   Cleared by the next hook. A claim older than a few minutes that no hook
 *   followed is a wake that never landed (the API restarted mid-wake, the
 *   host never ran it), and a new reply may claim the session again, so a
 *   lost wake cannot leave the session unwakeable for good.
 *   - Its own narrow table, not a column on `work_session`: it is rewritten
 *     twice a turn, and `work_session` is a wide, indexed, versioned row
 *     that every session read touches.
 *   - Keyed by `(organizationId, sessionId)`, which is also the foreign key
 *     to `work_session(organizationId, id)`, cascading: a session's idle mark
 *     means nothing without it. Every reader holds both ids.
 *   - No history: only the latest state is kept, so it is bounded by the
 *     sessions.
 *
 * Access patterns: mark a session listening or idle (each Stop hook, an
 * upsert by the primary key) and claim an idle (or stale waking) session
 * (each reply, an update by the primary key).
 */
export class AddCloudSessionIdle1794137373046 implements MigrationInterface {
  name = 'AddCloudSessionIdle1794137373046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE session_cloud_idle (
        "organizationId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "idleSince" timestamptz,
        "wakingSince" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_session_cloud_idle" PRIMARY KEY ("organizationId", "sessionId")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE session_cloud_idle ADD CONSTRAINT "FK_session_cloud_idle_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE session_cloud_idle`);
  }
}
