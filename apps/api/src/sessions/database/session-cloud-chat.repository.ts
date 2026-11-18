import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { type CloudReplyDelivery, QUEUE_NAMES } from '@oppenheimer/shared';
import type { Repository } from 'typeorm';
import type {
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

const asReply = (row: ReplyRow): CloudChatReply => ({
  id: row.id,
  authorId: row.authorId,
  text: row.text,
  createdAt: new Date(row.createdAt),
  collectedAt: row.collectedAt ? new Date(row.collectedAt) : null,
  deliveredVia: row.deliveredVia,
});

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
    // One statement for the batch; PK_session_cloud_line turns a resent line
    // into nothing, so a hook retrying after a dropped answer changes nothing.
    const inserted: unknown[] = await this.lines.query(
      `INSERT INTO session_cloud_line ("organizationId", "sessionId", "seq", "line")
       SELECT $1, $2, $3 + (ordinality - 1)::integer, line
         FROM unnest($4::text[]) WITH ORDINALITY AS batch(line, ordinality)
       ON CONFLICT ("sessionId", "seq") DO NOTHING
       RETURNING "seq"`,
      [organizationId, sessionId, from, lines],
    );
    return inserted.length;
  }

  async findLines(sessionId: string, from: number, limit: number): Promise<CloudChatLine[]> {
    // PK_session_cloud_line: a range of one session's numbers, in order.
    const rows: CloudChatLine[] = await this.lines.query(
      `SELECT "seq", "line" FROM session_cloud_line
        WHERE "sessionId" = $1 AND "seq" >= $2
        ORDER BY "seq" LIMIT $3`,
      [sessionId, from, limit],
    );
    return rows;
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
      `SELECT ${REPLY_COLUMNS} FROM session_cloud_reply
        WHERE "organizationId" = $1 AND "sessionId" = $2
        ORDER BY "createdAt", id LIMIT $3`,
      [organizationId, sessionId, limit],
    );
    return rows.map(asReply);
  }

  async collectReply(sessionId: string): Promise<CloudChatReply | null> {
    // The claim through IDX_session_cloud_reply_waiting; SKIP LOCKED so a
    // second hook asking at once takes the next one or none, never the same.
    // An UPDATE comes back as `[rows, affected]`.
    const [rows]: [ReplyRow[], number] = await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = now(), "deliveredVia" = 'hook'
        WHERE id = (
          SELECT id FROM session_cloud_reply
           WHERE "sessionId" = $1 AND "collectedAt" IS NULL
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
      `UPDATE session_cloud_reply SET "collectedAt" = now(), "deliveredVia" = 'host'
        WHERE id = $1 AND "sessionId" = $2 AND "collectedAt" IS NULL
       RETURNING ${REPLY_COLUMNS}`,
      [replyId, sessionId],
    );
    return rows[0] ? asReply(rows[0]) : null;
  }

  async releaseHostClaim(sessionId: string, replyId: string): Promise<void> {
    await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = NULL, "deliveredVia" = NULL
        WHERE id = $1 AND "sessionId" = $2 AND "deliveredVia" = 'host'`,
      [replyId, sessionId],
    );
  }
}
