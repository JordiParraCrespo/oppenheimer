import { type EntityManager, In } from 'typeorm';
import type { SessionLaunchFile } from '../domain/session-launch-file.types';
import { readFirstPrompt } from '../domain/session-log-entry.factory';
import { SESSION_EVENT_KINDS } from '../domain/session-state.policy';
import type { WorkSessionEventEntity } from '../domain/work-session-event.entity';
import { type AppendedEventRow, WorkSessionEventMapper } from '../work-session-event.mapper';
import type { NewSessionEvent, SessionEventPage } from './work-session.repository.port';
import { WorkSessionEventOrmEntity } from './work-session-event.orm-entity';

/**
 * The `work_session_event` table, the session's log, for `WorkSessionRepository`
 * alone. The append runs under the session row's lock, on the transaction the
 * session's adapter opened; the reads are the log's pages.
 */
export class WorkSessionEventRepository {
  constructor(private readonly manager: EntityManager) {}

  /**
   * The batch in **one statement**: skip the keys already logged, number the rest
   * after the current maximum in the caller's order, insert them, and return the new
   * entries in `seq` order.
   *
   * It must run **after** the `FOR UPDATE` statement has returned, never folded into
   * it. Under READ COMMITTED a statement's snapshot is taken before it blocks on a row
   * lock, so a `MAX("seq")` in the locking statement would miss the appender ahead of
   * us, and every waiter would allocate the same numbers. Started once the lock is
   * held, its `MAX`, "already present" check and insert all read one snapshot that
   * sees every earlier appender.
   *
   * Under the lock nobody else inserts this session's keys and the batch has no
   * duplicates, so `ON CONFLICT` should never fire; if it did, `seq` would gap, so a
   * short count throws and the transaction rolls back.
   */
  async insertBatch(
    manager: EntityManager,
    sessionId: string,
    events: NewSessionEvent[],
  ): Promise<WorkSessionEventEntity[]> {
    const rows: AppendedEventRow[] = await manager.query(
      `WITH input AS (
         SELECT e."ord", e."idempotencyKey", e."source", e."kind", e."payload", e."occurredAt"
           FROM jsonb_to_recordset($2::jsonb)
             AS e("ord" integer, "idempotencyKey" text, "source" text, "kind" text,
                  "payload" jsonb, "occurredAt" timestamptz)
       ),
       fresh AS (
         SELECT i.* FROM input i
          WHERE NOT EXISTS (SELECT 1 FROM "work_session_event" x
                             WHERE x."sessionId" = $1 AND x."idempotencyKey" = i."idempotencyKey")
       ),
       base AS (
         SELECT COALESCE(MAX("seq"), 0) AS "seq" FROM "work_session_event" WHERE "sessionId" = $1
       ),
       landed AS (
         INSERT INTO "work_session_event"
           ("sessionId", "seq", "idempotencyKey", "source", "kind", "payload", "occurredAt")
         SELECT $1, base."seq" + row_number() OVER (ORDER BY f."ord"),
                f."idempotencyKey", f."source", f."kind", f."payload", f."occurredAt"
           FROM fresh f CROSS JOIN base
         ON CONFLICT ("sessionId", "idempotencyKey") DO NOTHING
         RETURNING "id", "seq", "idempotencyKey", "source", "kind", "payload",
                   "occurredAt", "recordedAt"
       )
       -- One row even when nothing landed, so the count of what should have is
       -- always there to check against.
       SELECT (SELECT count(*) FROM fresh)::integer AS "expected", landed.*
         FROM (SELECT 1) AS one LEFT JOIN landed ON true
        ORDER BY landed."seq"`,
      [sessionId, WorkSessionEventMapper.toAppendRecordset(events)],
    );
    const landed = rows.filter((row) => row.id !== null);
    const expected = rows[0]?.expected ?? 0;
    if (landed.length !== expected) {
      throw new Error(
        `Session ${sessionId}: ${expected} new log entries were numbered but ${landed.length} landed`,
      );
    }
    return landed.map((row) => WorkSessionEventMapper.appendedToDomain(sessionId, row));
  }

  async findPage(
    sessionId: string,
    afterSeq: number | undefined,
    limit: number,
  ): Promise<SessionEventPage> {
    const query = this.manager
      .getRepository(WorkSessionEventOrmEntity)
      .createQueryBuilder('event')
      .where('event.sessionId = :sessionId', { sessionId })
      .orderBy('event.seq', 'ASC')
      // One more than asked for, so "is there another page" needs no second count
      // over a table that only ever grows.
      .take(limit + 1);
    if (afterSeq !== undefined) query.andWhere('event.seq > :afterSeq', { afterSeq });

    const records = await query.getMany();
    const page = records.slice(0, limit);
    return {
      events: page.map((record) => WorkSessionEventMapper.toDomain(record)),
      nextSeq: records.length > limit ? (page[page.length - 1]?.seq ?? null) : null,
    };
  }

  async findLatest(sessionId: string, limit: number): Promise<WorkSessionEventEntity[]> {
    // Backwards along IDX_work_session_event_session_seq, then put back in order.
    const records = await this.manager
      .getRepository(WorkSessionEventOrmEntity)
      .createQueryBuilder('event')
      .where('event.sessionId = :sessionId', { sessionId })
      .orderBy('event.seq', 'DESC')
      .take(limit)
      .getMany();
    return records.reverse().map((record) => WorkSessionEventMapper.toDomain(record));
  }

  /** Each session's first task, with the images it names, for those that have one. */
  async findFirstPrompts(
    sessionIds: string[],
  ): Promise<Map<string, { prompt: string; images: SessionLaunchFile[] }>> {
    const prompts = await this.manager.getRepository(WorkSessionEventOrmEntity).find({
      where: { sessionId: In(sessionIds), kind: SESSION_EVENT_KINDS.PROMPT_FIRST },
      select: { sessionId: true, payload: true },
    });
    const firstPrompts = new Map<string, { prompt: string; images: SessionLaunchFile[] }>();
    for (const event of prompts) {
      const first = readFirstPrompt(event.payload);
      if (first && !firstPrompts.has(event.sessionId)) {
        firstPrompts.set(event.sessionId, { prompt: first.text, images: first.images });
      }
    }
    return firstPrompts;
  }

  async deleteForOrganization(manager: EntityManager, organizationId: string): Promise<void> {
    await manager
      .createQueryBuilder()
      .delete()
      .from(WorkSessionEventOrmEntity)
      .where(
        `"sessionId" IN (SELECT "id" FROM "work_session" WHERE "organizationId" = :organizationId)`,
        { organizationId },
      )
      .execute();
  }
}
