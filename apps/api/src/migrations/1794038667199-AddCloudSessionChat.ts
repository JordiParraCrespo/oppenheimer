import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A Claude Code cloud session's chat in the console
 * (`product/next-steps/cloud-agents.md`, "The chat of a cloud session"). Two
 * hooks in the cloud session carry it: a SessionStart hook sends the
 * session's transcript, a Stop hook collects what the person typed.
 *
 * - `session_cloud_line`: the transcript, one row per line as Claude Code
 *   wrote it, numbered from 0. Append-only: a hook sends a batch again after
 *   a failure, and `PK_session_cloud_line` on `(sessionId, seq)` makes the
 *   repeat a no-op. `line` is the raw JSON text, never parsed here: the
 *   console's chat reads the same lines a runner sends for a host session.
 *   It lives as long as its session (the cascade); a session's history is
 *   what bounds it.
 *   - `(organizationId, sessionId) → work_session(organizationId, id)`,
 *     cascading. The primary key leads with `sessionId`, which serves the
 *     one read (a session's lines after a number) and the cascade together
 *     with `IDX_session_cloud_line_tenant`.
 * - `session_cloud_reply`: what the person typed in the console for the
 *   agent, waiting until the Stop hook collects it (`collectedAt`). The
 *   oldest uncollected reply is claimed with `FOR UPDATE SKIP LOCKED`
 *   through `IDX_session_cloud_reply_waiting`, so two hooks never take one.
 *   `authorId` keeps who wrote it; set null when the account goes, the
 *   reply stays in the chat.
 *
 * Access patterns: a session's lines after a number (the console's reads)
 * and a batch's insert by the primary key; a session's oldest waiting reply
 * (each Stop hook) by `IDX_session_cloud_reply_waiting`; a session's replies
 * in order (the console) by `IDX_session_cloud_reply_session`, which also
 * backs the foreign key.
 */
export class AddCloudSessionChat1794038667199 implements MigrationInterface {
  name = 'AddCloudSessionChat1794038667199';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE session_cloud_line (
        "organizationId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "seq" integer NOT NULL,
        "line" text NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        CONSTRAINT "PK_session_cloud_line" PRIMARY KEY ("sessionId", "seq"),
        CONSTRAINT "CHK_session_cloud_line_seq" CHECK ("seq" >= 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_cloud_line_tenant" ON session_cloud_line ("organizationId", "sessionId")`,
    );
    await queryRunner.query(
      `ALTER TABLE session_cloud_line ADD CONSTRAINT "FK_session_cloud_line_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
    );

    await queryRunner.query(
      `CREATE TABLE session_cloud_reply (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        "organizationId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "authorId" uuid,
        "text" text NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "collectedAt" timestamp with time zone,
        CONSTRAINT "PK_session_cloud_reply" PRIMARY KEY (id),
        CONSTRAINT "CHK_session_cloud_reply_text" CHECK (char_length("text") > 0)
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_cloud_reply_session" ON session_cloud_reply ("organizationId", "sessionId", "createdAt", id)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_cloud_reply_waiting" ON session_cloud_reply ("sessionId", "createdAt") WHERE ("collectedAt" IS NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_session_cloud_reply_author" ON session_cloud_reply ("authorId") WHERE ("authorId" IS NOT NULL)`,
    );
    await queryRunner.query(
      `ALTER TABLE session_cloud_reply ADD CONSTRAINT "FK_session_cloud_reply_session" FOREIGN KEY ("organizationId", "sessionId") REFERENCES work_session("organizationId", id) ON DELETE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE session_cloud_reply ADD CONSTRAINT "FK_session_cloud_reply_author" FOREIGN KEY ("authorId") REFERENCES "user"(id) ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE session_cloud_reply`);
    await queryRunner.query(`DROP TABLE session_cloud_line`);
  }
}
