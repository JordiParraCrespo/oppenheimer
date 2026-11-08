import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type {
  CloudChatLine,
  CloudChatReply,
  SessionCloudChatRepositoryPort,
} from './session-cloud-chat.repository.port';
import { SessionCloudLineOrmEntity } from './session-cloud-line.orm-entity';
import { SessionCloudReplyOrmEntity } from './session-cloud-reply.orm-entity';

interface ReplyRow {
  id: string;
  authorId: string | null;
  text: string;
  createdAt: Date;
  collectedAt: Date | null;
}

const asReply = (row: ReplyRow): CloudChatReply => ({
  id: row.id,
  authorId: row.authorId,
  text: row.text,
  createdAt: new Date(row.createdAt),
  collectedAt: row.collectedAt ? new Date(row.collectedAt) : null,
});

@Injectable()
export class SessionCloudChatRepository implements SessionCloudChatRepositoryPort {
  constructor(
    @InjectRepository(SessionCloudLineOrmEntity)
    private readonly lines: Repository<SessionCloudLineOrmEntity>,
    @InjectRepository(SessionCloudReplyOrmEntity)
    private readonly replies: Repository<SessionCloudReplyOrmEntity>,
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
  ): Promise<CloudChatReply> {
    const [row]: ReplyRow[] = await this.replies.query(
      `INSERT INTO session_cloud_reply ("organizationId", "sessionId", "authorId", "text")
       VALUES ($1, $2, $3, $4)
       RETURNING id, "authorId", "text", "createdAt", "collectedAt"`,
      [organizationId, sessionId, authorId, text],
    );
    return asReply(row);
  }

  async findReplies(
    organizationId: string,
    sessionId: string,
    limit: number,
  ): Promise<CloudChatReply[]> {
    // IDX_session_cloud_reply_session.
    const rows: ReplyRow[] = await this.replies.query(
      `SELECT id, "authorId", "text", "createdAt", "collectedAt" FROM session_cloud_reply
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
      `UPDATE session_cloud_reply SET "collectedAt" = now()
        WHERE id = (
          SELECT id FROM session_cloud_reply
           WHERE "sessionId" = $1 AND "collectedAt" IS NULL
           ORDER BY "createdAt"
           LIMIT 1
           FOR UPDATE SKIP LOCKED)
       RETURNING id, "authorId", "text", "createdAt", "collectedAt"`,
      [sessionId],
    );
    return rows[0] ? asReply(rows[0]) : null;
  }

  async claimReply(sessionId: string, replyId: string): Promise<boolean> {
    const [rows]: [unknown[], number] = await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = now()
        WHERE id = $2 AND "sessionId" = $1 AND "collectedAt" IS NULL
       RETURNING id`,
      [sessionId, replyId],
    );
    return rows.length === 1;
  }

  async releaseReply(sessionId: string, replyId: string): Promise<void> {
    await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = NULL WHERE id = $2 AND "sessionId" = $1`,
      [sessionId, replyId],
    );
  }

  async markListening(organizationId: string, sessionId: string): Promise<void> {
    await this.markIdleAs(organizationId, sessionId, false);
  }

  async markIdle(organizationId: string, sessionId: string): Promise<void> {
    await this.markIdleAs(organizationId, sessionId, true);
  }

  async claimIdle(organizationId: string, sessionId: string): Promise<boolean> {
    // PK_session_cloud_idle; the row lock makes a second claim at once see
    // the first one's null and win nothing.
    const [rows]: [unknown[], number] = await this.replies.query(
      `UPDATE session_cloud_idle SET "idleSince" = NULL, "updatedAt" = now()
        WHERE "organizationId" = $1 AND "sessionId" = $2 AND "idleSince" IS NOT NULL
       RETURNING "sessionId"`,
      [organizationId, sessionId],
    );
    return rows.length === 1;
  }

  /** One upsert by PK_session_cloud_idle, at the database's time. */
  private async markIdleAs(
    organizationId: string,
    sessionId: string,
    idle: boolean,
  ): Promise<void> {
    await this.replies.query(
      `INSERT INTO session_cloud_idle ("organizationId", "sessionId", "idleSince")
       VALUES ($1, $2, CASE WHEN $3 THEN now() END)
       ON CONFLICT ("organizationId", "sessionId")
       DO UPDATE SET "idleSince" = EXCLUDED."idleSince", "updatedAt" = now()`,
      [organizationId, sessionId, idle],
    );
  }
}
