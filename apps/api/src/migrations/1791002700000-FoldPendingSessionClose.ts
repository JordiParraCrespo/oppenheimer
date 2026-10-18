import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * A close the host has not answered, folded onto the session row.
 *
 * Deleting a session records `session.close_requested` and sends the host a
 * `session.close`; the row resolves only when the host answers `session.closed`.
 * A close sent while the link was down, or queued on a link that dropped, was
 * never sent again, so the session sat stopped with a Restart button for good
 * and the console brought the deleted row back. The hello reconciliation now
 * sends every owed close again, and the console draws such a row as deleting,
 * so both need to know a close is owed without walking the log
 * (`session-state.policy.ts`: an input a list needs is a folded column).
 *
 * Four columns, all projections of the log like the rest of the fold:
 *
 * - `closeRequestedAt` (`timestamptz`, null when nothing is owed): the latest
 *   `session.close_requested` with no `session.closed`, refused close or
 *   `session.restart_requested` after it. A state with a time is a timestamp,
 *   not a boolean.
 * - `closeAcceptsUnpushedWork`: what that request sends again. `NOT NULL
 *   DEFAULT false`, the safe reading, and false whenever nothing is owed
 *   (`CHK_work_session_close_accepts`).
 * - `closeRefusalCode` / `closeRefusalDetail`: the host's `command.failed` for
 *   that close, which ends it — sending a refused close again on every hello
 *   would be refused again for ever. Bounded at the wire's own limits
 *   (`commandFailedSchema`: 32 and 500). A close cannot be owed and refused
 *   at once (`CHK_work_session_close_owed_or_refused`), and a detail has a code.
 *
 * No index: the one reader that filters, the hello reconciliation, already
 * reads "this host's unresolved sessions" through `IDX_work_session_host_state`
 * and looks at these columns on the rows it gets. None of them is indexed, so a
 * fold that moves them stays a HOT update.
 *
 * The backfill folds what logs already hold, so the sessions stuck today are
 * closed on their host's next hello. Unresolved sessions only (a resolved one
 * owes nothing), and only their last two lifecycle requests or answers: a close
 * is owed when the latest is a request, refused when the latest is a refusal of
 * a close that came right before it. The table holds a few thousand rows at
 * most, so one statement in the boot transaction is enough.
 */
export class FoldPendingSessionClose1791002700000 implements MigrationInterface {
  name = 'FoldPendingSessionClose1791002700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE work_session ADD COLUMN "closeRequestedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE work_session ADD COLUMN "closeAcceptsUnpushedWork" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE work_session ADD COLUMN "closeRefusalCode" character varying(32)`,
    );
    await queryRunner.query(
      `ALTER TABLE work_session ADD COLUMN "closeRefusalDetail" character varying(500)`,
    );
    await queryRunner.query(
      `WITH ranked AS (
         SELECT e."sessionId", e.kind, e.payload, e."occurredAt",
                row_number() OVER (PARTITION BY e."sessionId" ORDER BY e.seq DESC) AS n
           FROM work_session_event e
           JOIN work_session s ON s.id = e."sessionId" AND s.state <> 'resolved'
          WHERE e.kind IN ('session.close_requested', 'session.restart_requested', 'session.closed')
             OR (e.kind = 'command.failed' AND e.payload->>'command' = 'session.close')
       ),
       latest AS (
         SELECT l."sessionId", l.kind, l.payload, l."occurredAt", p.kind AS "previousKind"
           FROM ranked l
           LEFT JOIN ranked p ON p."sessionId" = l."sessionId" AND p.n = 2
          WHERE l.n = 1
       )
       UPDATE work_session s
          SET "closeRequestedAt" = CASE WHEN latest.kind = 'session.close_requested'
                                        THEN latest."occurredAt" END,
              "closeAcceptsUnpushedWork" = latest.kind = 'session.close_requested'
                                           AND COALESCE(latest.payload->>'acceptUnpushedWork', '') = 'true',
              "closeRefusalCode" = CASE WHEN latest.kind = 'command.failed'
                                        THEN left(COALESCE(NULLIF(latest.payload->>'code', ''), 'UNKNOWN'), 32) END,
              "closeRefusalDetail" = CASE WHEN latest.kind = 'command.failed'
                                          THEN left(NULLIF(latest.payload->>'detail', ''), 500) END
         FROM latest
        WHERE s.id = latest."sessionId"
          AND (latest.kind = 'session.close_requested'
               OR (latest.kind = 'command.failed'
                   AND latest."previousKind" = 'session.close_requested'))`,
    );
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_close_accepts" CHECK ("closeRequestedAt" IS NOT NULL OR NOT "closeAcceptsUnpushedWork")`,
    );
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_close_owed_or_refused" CHECK (num_nonnulls("closeRequestedAt", "closeRefusalCode") <= 1)`,
    );
    await queryRunner.query(
      `ALTER TABLE work_session ADD CONSTRAINT "CHK_work_session_close_refusal" CHECK ("closeRefusalDetail" IS NULL OR "closeRefusalCode" IS NOT NULL)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_close_refusal"',
    );
    await queryRunner.query(
      'ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_close_owed_or_refused"',
    );
    await queryRunner.query(
      'ALTER TABLE work_session DROP CONSTRAINT "CHK_work_session_close_accepts"',
    );
    await queryRunner.query('ALTER TABLE work_session DROP COLUMN "closeRefusalDetail"');
    await queryRunner.query('ALTER TABLE work_session DROP COLUMN "closeRefusalCode"');
    await queryRunner.query('ALTER TABLE work_session DROP COLUMN "closeAcceptsUnpushedWork"');
    await queryRunner.query('ALTER TABLE work_session DROP COLUMN "closeRequestedAt"');
  }
}
