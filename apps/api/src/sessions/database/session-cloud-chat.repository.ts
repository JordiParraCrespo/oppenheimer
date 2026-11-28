import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { type CloudChatSource, type CloudReplyDelivery, QUEUE_NAMES } from '@oppenheimer/shared';
import type { EntityManager, Repository } from 'typeorm';
import type {
  BrowserCloudReply,
  CloudChatEvent,
  CloudChatLine,
  CloudChatReply,
  CloudReplyWake,
  SessionCloudChatRepositoryPort,
} from './session-cloud-chat.repository.port';
import { SessionCloudLineOrmEntity } from './session-cloud-line.orm-entity';
import { SessionCloudReplyOrmEntity } from './session-cloud-reply.orm-entity';

/** The job that has a host send a reply the Stop hook did not take; its payload is the `CloudReplyWake`. */
export const WAKE_CLOUD_SESSION_JOB = 'wake-cloud-session';

interface ReplyRow {
  id: string;
  authorId: string | null;
  text: string;
  createdAt: Date;
  collectedAt: Date | null;
  deliveredVia: CloudReplyDelivery | null;
}

const REPLY_COLUMNS = `id, "authorId", "text", "createdAt", "collectedAt", "deliveredVia"`;

/**
 * The one rule for a lapsed lease: a claim of the extension's that it did not
 * confirm before `leaseUntil` waits again. Every claim and every read of a
 * reply's state goes through it, so the takers and the console never disagree
 * about what a lapsed claim is. `alias` qualifies the columns in a join.
 */
function lapsed(alias = ''): string {
  return `(${alias}"deliveredVia" = 'browser' AND ${alias}"leaseUntil" < now())`;
}

/** A reply nothing has delivered: never claimed, or a claim that lapsed. */
function waiting(alias = ''): string {
  return `(${alias}"collectedAt" IS NULL OR ${lapsed(alias)})`;
}

/** The columns as a reader sees them: a lapsed claim reads as waiting. */
const REPLY_AS_SEEN = `id, "authorId", "text", "createdAt",
  CASE WHEN ${lapsed()} THEN NULL ELSE "collectedAt" END AS "collectedAt",
  CASE WHEN ${lapsed()} THEN NULL ELSE "deliveredVia" END AS "deliveredVia"`;

const asReply = (row: ReplyRow): CloudChatReply => ({
  id: row.id,
  authorId: row.authorId,
  text: row.text,
  createdAt: new Date(row.createdAt),
  collectedAt: row.collectedAt ? new Date(row.collectedAt) : null,
  deliveredVia: row.deliveredVia,
});

/** Serializes the writers of one session's lines until the transaction ends. */
async function lockSessionLines(manager: EntityManager, sessionId: string): Promise<void> {
  await manager.query(`SELECT pg_advisory_xact_lock(hashtext('session_cloud_line:' || $1))`, [
    sessionId,
  ]);
}

@Injectable()
export class SessionCloudChatRepository implements SessionCloudChatRepositoryPort {
  constructor(
    @InjectRepository(SessionCloudLineOrmEntity)
    private readonly lines: Repository<SessionCloudLineOrmEntity>,
    @InjectRepository(SessionCloudReplyOrmEntity)
    private readonly replies: Repository<SessionCloudReplyOrmEntity>,
    private readonly outbox: OutboxService,
  ) {}

  async appendLines(
    organizationId: string,
    sessionId: string,
    from: number,
    lines: readonly string[],
  ): Promise<number> {
    if (lines.length === 0) return 0;
    return this.outbox.transaction(async (manager) => {
      await lockSessionLines(manager, sessionId);
      // One statement for the batch; PK_session_cloud_line turns a resent line
      // into nothing, so a hook retrying after a dropped answer changes nothing.
      // A session the extension has read is served from claude.ai's own log, so
      // the hook's copy is no longer kept (UQ_session_cloud_line_event finds one).
      const inserted: unknown[] = await manager.query(
        `INSERT INTO session_cloud_line ("organizationId", "sessionId", "seq", "line")
         SELECT $1, $2, $3 + (ordinality - 1)::integer, line
           FROM unnest($4::text[]) WITH ORDINALITY AS batch(line, ordinality)
          WHERE NOT EXISTS (
            SELECT 1 FROM session_cloud_line
             WHERE "sessionId" = $2 AND "eventId" IS NOT NULL)
         ON CONFLICT ("sessionId", "seq") DO NOTHING
         RETURNING "seq"`,
        [organizationId, sessionId, from, lines],
      );
      return inserted.length;
    });
  }

  async appendEvents(
    organizationId: string,
    sessionId: string,
    events: readonly CloudChatEvent[],
    from?: number,
  ): Promise<number> {
    if (events.length === 0) return 0;
    return this.outbox.transaction(async (manager) => {
      // One writer per session at a time, the hook's appends included: each
      // new event is numbered against the lines held.
      await lockSessionLines(manager, sessionId);
      // The first events replace the hook's copy: the two number the same
      // conversation differently, and claude.ai's log is the whole of it.
      await manager.query(
        `DELETE FROM session_cloud_line
          WHERE "sessionId" = $1 AND "eventId" IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM session_cloud_line
               WHERE "sessionId" = $1 AND "eventId" IS NOT NULL)`,
        [sessionId],
      );
      // New events only (an id held already, or twice in the batch, is
      // skipped). With `from`, each at its place in the log, so stretches
      // sent in any order by any browser read in the log's order, and a place
      // held already is skipped too; without, after the last line held.
      const inserted: unknown[] = await manager.query(
        `WITH batch AS (
           SELECT DISTINCT ON (id) id, line, ordinality
             FROM unnest($3::text[], $4::text[]) WITH ORDINALITY AS e(id, line, ordinality)
            ORDER BY id, ordinality),
         fresh AS (
           SELECT id, line, ordinality, row_number() OVER (ORDER BY ordinality) AS n
             FROM batch
            WHERE NOT EXISTS (
              SELECT 1 FROM session_cloud_line held
               WHERE held."sessionId" = $2 AND held."eventId" = batch.id)),
         base AS (
           SELECT coalesce(max("seq") + 1, 0) AS next
             FROM session_cloud_line WHERE "sessionId" = $2)
         INSERT INTO session_cloud_line ("organizationId", "sessionId", "seq", "eventId", "line")
         SELECT $1, $2,
                (CASE WHEN $5::integer IS NULL THEN base.next + fresh.n - 1
                      ELSE $5::integer + fresh.ordinality - 1 END)::integer,
                fresh.id, fresh.line
           FROM fresh, base
         ON CONFLICT DO NOTHING
         RETURNING "seq"`,
        [
          organizationId,
          sessionId,
          events.map((event) => event.id),
          events.map((event) => event.line),
          from ?? null,
        ],
      );
      return inserted.length;
    });
  }

  async findSource(sessionId: string): Promise<CloudChatSource> {
    // UQ_session_cloud_line_event: one probe of the partial index.
    const [row]: { browser: boolean }[] = await this.lines.query(
      `SELECT EXISTS (
         SELECT 1 FROM session_cloud_line WHERE "sessionId" = $1 AND "eventId" IS NOT NULL
       ) AS browser`,
      [sessionId],
    );
    return row?.browser ? 'browser' : 'hook';
  }

  async findLines(
    sessionId: string,
    from: number | undefined,
    limit: number,
  ): Promise<CloudChatLine[]> {
    // PK_session_cloud_line: a range of one session's numbers, in order.
    const rows: CloudChatLine[] = await this.lines.query(
      `SELECT "seq", "line" FROM session_cloud_line
        WHERE "sessionId" = $1 AND ($2::integer IS NULL OR "seq" >= $2)
        ORDER BY "seq" LIMIT $3`,
      [sessionId, from ?? null, limit],
    );
    return rows;
  }

  async countLinesBefore(sessionId: string, before: number): Promise<number> {
    // PK_session_cloud_line: a range of one session's numbers, counted in the index.
    const [row]: { held: string }[] = await this.lines.query(
      `SELECT count(*) AS held FROM session_cloud_line WHERE "sessionId" = $1 AND "seq" < $2`,
      [sessionId, before],
    );
    return Number(row?.held ?? 0);
  }

  async addReply(
    organizationId: string,
    sessionId: string,
    authorId: string,
    text: string,
    wakeAt: Date,
  ): Promise<CloudChatReply> {
    return this.outbox.transaction(async (manager) => {
      const [row]: ReplyRow[] = await manager.query(
        `INSERT INTO session_cloud_reply ("organizationId", "sessionId", "authorId", "text")
         VALUES ($1, $2, $3, $4)
         RETURNING ${REPLY_COLUMNS}`,
        [organizationId, sessionId, authorId, text],
      );
      const wake: CloudReplyWake = { sessionId, replyId: row.id };
      await this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.CLOUD_REPLY_WAKES,
        jobName: WAKE_CLOUD_SESSION_JOB,
        payload: { ...wake },
        reason: `wake cloud session ${sessionId} with reply ${row.id}`,
        aggregateId: sessionId,
        correlationId: null,
        availableAt: wakeAt,
      });
      return asReply(row);
    });
  }

  async findReplies(
    organizationId: string,
    sessionId: string,
    limit: number,
  ): Promise<CloudChatReply[]> {
    // IDX_session_cloud_reply_session.
    const rows: ReplyRow[] = await this.replies.query(
      `SELECT ${REPLY_AS_SEEN} FROM session_cloud_reply
        WHERE "organizationId" = $1 AND "sessionId" = $2
        ORDER BY "createdAt", id LIMIT $3`,
      [organizationId, sessionId, limit],
    );
    return rows.map(asReply);
  }

  async collectReply(sessionId: string): Promise<CloudChatReply | null> {
    // The claim through IDX_session_cloud_reply_waiting, and a lapsed lease
    // through IDX_session_cloud_reply_leased; SKIP LOCKED so a
    // second hook asking at once takes the next one or none, never the same.
    // An UPDATE comes back as `[rows, affected]`.
    const [rows]: [ReplyRow[], number] = await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = now(), "deliveredVia" = 'hook', "leaseUntil" = NULL
        WHERE id = (
          SELECT id FROM session_cloud_reply
           WHERE "sessionId" = $1 AND ${waiting()}
           ORDER BY "createdAt"
           LIMIT 1
           FOR UPDATE SKIP LOCKED)
       RETURNING ${REPLY_COLUMNS}`,
      [sessionId],
    );
    return rows[0] ? asReply(rows[0]) : null;
  }

  async claimReplyForHost(sessionId: string, replyId: string): Promise<CloudChatReply | null> {
    // The same `collectedAt IS NULL` claim as the hook's: under READ COMMITTED
    // the loser of a race re-reads the row the winner wrote and matches nothing.
    const [rows]: [ReplyRow[], number] = await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = now(), "deliveredVia" = 'host', "leaseUntil" = NULL
        WHERE id = $1 AND "sessionId" = $2 AND ${waiting()}
       RETURNING ${REPLY_COLUMNS}`,
      [replyId, sessionId],
    );
    return rows[0] ? asReply(rows[0]) : null;
  }

  async claimRepliesForBrowser(
    organizationId: string,
    authorId: string,
    leaseSeconds: number,
  ): Promise<BrowserCloudReply[]> {
    // The same `collectedAt IS NULL` claim as the hook's and the host's, for
    // every waiting reply of this person in an open Claude Code cloud session
    // with a claude.ai id; IDX_session_cloud_reply_author finds them.
    const [rows]: [(ReplyRow & { cloudSessionId: string })[], number] = await this.replies.query(
      `UPDATE session_cloud_reply reply
          SET "collectedAt" = now(), "deliveredVia" = 'browser',
              "leaseUntil" = now() + make_interval(secs => $3)
         FROM work_session session
        WHERE reply."authorId" = $2
          AND reply."organizationId" = $1
          AND ${waiting('reply.')}
          AND session.id = reply."sessionId"
          AND session."organizationId" = reply."organizationId"
          AND session.place = 'cloud'
          AND session.agent = 'claude-code'
          AND session."agentSessionId" IS NOT NULL
          AND session.state <> 'resolved'
       RETURNING reply.id, reply."authorId", reply."text", reply."createdAt",
                 reply."collectedAt", reply."deliveredVia",
                 session."agentSessionId" AS "cloudSessionId"`,
      [organizationId, authorId, leaseSeconds],
    );
    return rows
      .map((row) => ({ ...asReply(row), cloudSessionId: row.cloudSessionId }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  }

  async releaseBrowserClaim(
    organizationId: string,
    authorId: string,
    replyId: string,
  ): Promise<boolean> {
    const [, affected]: [unknown[], number] = await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = NULL, "deliveredVia" = NULL, "leaseUntil" = NULL
        WHERE id = $1 AND "organizationId" = $2 AND "authorId" = $3
          AND "deliveredVia" = 'browser' AND "leaseUntil" IS NOT NULL`,
      [replyId, organizationId, authorId],
    );
    return affected === 1;
  }

  async deferWakeWhileLeased(sessionId: string, replyId: string): Promise<Date | null> {
    return this.outbox.transaction(async (manager) => {
      const [held]: { leaseUntil: Date }[] = await manager.query(
        `SELECT "leaseUntil" FROM session_cloud_reply
          WHERE id = $1 AND "sessionId" = $2
            AND "deliveredVia" = 'browser' AND "leaseUntil" IS NOT NULL`,
        [replyId, sessionId],
      );
      if (!held) return null;
      // A second past the lease, when the claim has lapsed and a host can take it.
      const at = new Date(new Date(held.leaseUntil).getTime() + 1000);
      const wake: CloudReplyWake = { sessionId, replyId };
      await this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.CLOUD_REPLY_WAKES,
        jobName: WAKE_CLOUD_SESSION_JOB,
        payload: { ...wake },
        reason: `wake cloud session ${sessionId} with reply ${replyId} once the browser's claim lapses`,
        aggregateId: sessionId,
        correlationId: null,
        availableAt: at,
      });
      return at;
    });
  }

  async confirmBrowserDelivery(
    organizationId: string,
    authorId: string,
    replyId: string,
  ): Promise<boolean> {
    // Delivered for good: the lease goes, so nothing claims it again.
    const [, affected]: [unknown[], number] = await this.replies.query(
      `UPDATE session_cloud_reply SET "leaseUntil" = NULL
        WHERE id = $1 AND "organizationId" = $2 AND "authorId" = $3
          AND "deliveredVia" = 'browser' AND "leaseUntil" IS NOT NULL`,
      [replyId, organizationId, authorId],
    );
    return affected === 1;
  }

  async releaseHostClaim(sessionId: string, replyId: string): Promise<void> {
    await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = NULL, "deliveredVia" = NULL, "leaseUntil" = NULL
        WHERE id = $1 AND "sessionId" = $2 AND "deliveredVia" = 'host'`,
      [replyId, sessionId],
    );
  }
}
