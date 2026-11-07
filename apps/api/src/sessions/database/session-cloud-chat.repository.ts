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

  async findLines(sessionId: string, after: number, limit: number): Promise<CloudChatLine[]> {
    // PK_session_cloud_line: a range of one session's numbers, in order.
    const rows: CloudChatLine[] = await this.lines.query(
      `SELECT "seq", "line" FROM session_cloud_line
        WHERE "sessionId" = $1 AND "seq" >= $2
        ORDER BY "seq" LIMIT $3`,
      [sessionId, after, limit],
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

  async collectReply(sessionId: string, at: Date): Promise<CloudChatReply | null> {
    // The claim through IDX_session_cloud_reply_waiting; SKIP LOCKED so a
    // second hook asking at once takes the next one or none, never the same.
    // An UPDATE comes back as `[rows, affected]`.
    const [rows]: [ReplyRow[], number] = await this.replies.query(
      `UPDATE session_cloud_reply SET "collectedAt" = $2
        WHERE id = (
          SELECT id FROM session_cloud_reply
           WHERE "sessionId" = $1 AND "collectedAt" IS NULL
           ORDER BY "createdAt"
           LIMIT 1
           FOR UPDATE SKIP LOCKED)
       RETURNING id, "authorId", "text", "createdAt", "collectedAt"`,
      [sessionId, at],
    );
    return rows[0] ? asReply(rows[0]) : null;
  }
}
