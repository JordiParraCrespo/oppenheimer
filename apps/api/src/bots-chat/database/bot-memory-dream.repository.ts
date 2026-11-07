import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type EntityManager } from 'typeorm';
import { BotMemoryDreamMapper } from '../bot-memory-dream.mapper';
import type { StoredDream } from '../domain/bot-dream.policy';
import type { BotMemoryDreamOrmEntity } from './bot-memory-dream.orm-entity';
import type {
  BotMemoryDreamRepositoryPort,
  DreamWeight,
  DreamWrite,
} from './bot-memory-dream.repository.port';

/** The job that dreams a bot's memory; its payload is `{ organizationId, botId, force }`. */
export const DREAM_BOT_MEMORY_JOB = 'dream-bot-memory';

const DREAM_COLUMNS = `id, "organizationId", "botId", "factsBefore", "factsAfter", note, "createdAt", "undoneAt"`;

type DreamRow = Pick<
  BotMemoryDreamOrmEntity,
  | 'id'
  | 'organizationId'
  | 'botId'
  | 'factsBefore'
  | 'factsAfter'
  | 'note'
  | 'createdAt'
  | 'undoneAt'
> & { outputFactIds?: string[] };

/**
 * A bot's latest dream and the rewrite it stands for (`25-bots.md` §4.1,
 * "Dreaming"). Every write locks the bot's row first (`FOR NO KEY UPDATE`),
 * the lock a fact's insert takes to count against the cap, so a dream, its
 * undo and a `remember` never interleave. The facts a dream rewrites are the
 * bot's own that it wrote itself (`IDX_bot_memory_fact_bot`), at most
 * `BOT_MEMORY_FACTS_MAX`; the dream's row is read and written by its
 * primary key.
 */
@Injectable()
export class BotMemoryDreamRepository implements BotMemoryDreamRepositoryPort {
  constructor(
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly mapper: BotMemoryDreamMapper,
  ) {}

  async findLatest(organizationId: string, botId: string): Promise<Option<StoredDream>> {
    const rows: DreamRow[] = await this.dataSource.query(
      `SELECT ${DREAM_COLUMNS} FROM bot_memory_dream WHERE "organizationId" = $1 AND "botId" = $2`,
      [organizationId, botId],
    );
    return rows[0] ? Some(this.mapper.toDomain(rows[0])) : None;
  }

  async weigh(organizationId: string, botId: string): Promise<DreamWeight> {
    const [row]: { rewritable: number; writesSince: number; lastDreamAt: Date | null }[] =
      await this.dataSource.query(
        `SELECT count(f.id) FILTER (WHERE f.source = 'bot')::int AS rewritable,
                count(f.id) FILTER (
                  WHERE greatest(f."createdAt", f."updatedAt") > coalesce(d."createdAt", '-infinity')
                )::int AS "writesSince",
                d."createdAt" AS "lastDreamAt"
           FROM (SELECT $1::uuid AS "organizationId", $2::uuid AS "botId") b
           LEFT JOIN bot_memory_dream d
             ON d."organizationId" = b."organizationId" AND d."botId" = b."botId"
           LEFT JOIN bot_memory_fact f
             ON f."organizationId" = b."organizationId" AND f."botId" = b."botId"
          GROUP BY d."createdAt"`,
        [organizationId, botId],
      );
    return {
      rewritable: row?.rewritable ?? 0,
      writesSince: row?.writesSince ?? 0,
      lastDreamAt: row?.lastDreamAt ? new Date(row.lastDreamAt) : null,
    };
  }

  async apply(dream: DreamWrite, max: number): Promise<'applied' | 'changed' | 'missing'> {
    return this.outbox.transaction(async (manager) => {
      if (!(await this.lockBot(manager, dream.organizationId, dream.botId))) {
        return 'missing' as const;
      }
      const current: { id: string; updatedAt: Date }[] = await manager.query(
        `SELECT id, "updatedAt" FROM bot_memory_fact
          WHERE "organizationId" = $1 AND "botId" = $2 AND source = 'bot'`,
        [dream.organizationId, dream.botId],
      );
      if (!sameFacts(current, dream.read)) return 'changed' as const;
      const [{ others }]: { others: number }[] = await manager.query(
        `SELECT count(*)::int AS others FROM bot_memory_fact
          WHERE "organizationId" = $1 AND "botId" = $2 AND source <> 'bot'`,
        [dream.organizationId, dream.botId],
      );
      if (others + dream.facts.length > max) return 'changed' as const;
      const readIds = dream.read.map((fact) => fact.id);
      const outputIds = dream.facts.map(() => randomUUID());
      await manager.query(
        `INSERT INTO bot_memory_dream
           ("organizationId", "botId", id, "factsBefore", "factsAfter", note, snapshot, "outputFactIds", "createdAt", "undoneAt", "updatedAt")
         SELECT $1, $2, $3, $4, $5, $6,
                coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f."createdAt", f.id)
                            FROM bot_memory_fact f
                           WHERE f."organizationId" = $1 AND f."botId" = $2 AND f.id = ANY($7::uuid[])), '[]'::jsonb),
                $8::uuid[], now(), NULL, now()
         ON CONFLICT ("organizationId", "botId") DO UPDATE SET
           id = EXCLUDED.id, "factsBefore" = EXCLUDED."factsBefore", "factsAfter" = EXCLUDED."factsAfter",
           note = EXCLUDED.note, snapshot = EXCLUDED.snapshot, "outputFactIds" = EXCLUDED."outputFactIds",
           "createdAt" = EXCLUDED."createdAt", "undoneAt" = NULL, "updatedAt" = now()`,
        [
          dream.organizationId,
          dream.botId,
          dream.id,
          readIds.length,
          dream.facts.length,
          dream.note,
          readIds,
          outputIds,
        ],
      );
      await manager.query(
        `DELETE FROM bot_memory_fact
          WHERE "organizationId" = $1 AND "botId" = $2 AND id = ANY($3::uuid[])`,
        [dream.organizationId, dream.botId, readIds],
      );
      await manager.query(
        `INSERT INTO bot_memory_fact (id, "organizationId", "botId", content, source, tier, scope, "createdAt", "updatedAt")
         SELECT n.id, $1, $2, n.content, 'bot', n.tier, n.scope, n."createdAt", now()
           FROM unnest($3::uuid[], $4::varchar[], $5::varchar[], $6::varchar[], $7::timestamptz[])
             AS n(id, content, tier, scope, "createdAt")`,
        [
          dream.organizationId,
          dream.botId,
          outputIds,
          dream.facts.map((fact) => fact.content),
          dream.facts.map((fact) => fact.tier),
          dream.facts.map((fact) => fact.scope),
          dream.facts.map((fact) => fact.createdAt.toISOString()),
        ],
      );
      return 'applied' as const;
    });
  }

  async undo(organizationId: string, botId: string, max: number): Promise<StoredDream | null> {
    return this.outbox.transaction(async (manager) => {
      if (!(await this.lockBot(manager, organizationId, botId))) return null;
      const [row]: DreamRow[] = await manager.query(
        `SELECT ${DREAM_COLUMNS}, "outputFactIds" FROM bot_memory_dream
          WHERE "organizationId" = $1 AND "botId" = $2 AND "undoneAt" IS NULL`,
        [organizationId, botId],
      );
      if (!row) return null;
      await manager.query(
        `DELETE FROM bot_memory_fact
          WHERE "organizationId" = $1 AND "botId" = $2 AND id = ANY($3::uuid[])`,
        [organizationId, botId, row.outputFactIds ?? []],
      );
      await manager.query(
        `INSERT INTO bot_memory_fact (id, "organizationId", "botId", content, source, tier, scope, "createdAt", "updatedAt")
         SELECT (e->>'id')::uuid, $1, $2, e->>'content', e->>'source', e->>'tier', e->>'scope',
                (e->>'createdAt')::timestamptz, (e->>'updatedAt')::timestamptz
           FROM bot_memory_dream d, jsonb_array_elements(d.snapshot) e
          WHERE d."organizationId" = $1 AND d."botId" = $2
         ON CONFLICT (id) DO NOTHING`,
        [organizationId, botId],
      );
      // Past the cap, what the bot saved since the dream made room by its oldest log facts.
      await manager.query(
        `DELETE FROM bot_memory_fact WHERE id IN (
           SELECT id FROM bot_memory_fact
            WHERE "organizationId" = $1 AND "botId" = $2 AND tier = 'log'
            ORDER BY "createdAt", id
            LIMIT greatest((SELECT count(*) FROM bot_memory_fact
                             WHERE "organizationId" = $1 AND "botId" = $2) - $3, 0))`,
        [organizationId, botId, max],
      );
      const [[undone]]: [DreamRow[], number] = await manager.query(
        `UPDATE bot_memory_dream SET "undoneAt" = now(), "updatedAt" = now()
          WHERE "organizationId" = $1 AND "botId" = $2
          RETURNING ${DREAM_COLUMNS}`,
        [organizationId, botId],
      );
      return this.mapper.toDomain(undone);
    });
  }

  async stageDream(
    organizationId: string,
    botId: string,
    force: boolean,
    correlationId: string | null,
  ): Promise<void> {
    await this.outbox.transaction((manager) =>
      this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.BOT_DREAMS,
        jobName: DREAM_BOT_MEMORY_JOB,
        payload: { organizationId, botId, force },
        reason: force
          ? `bot ${botId}: its owner asked it to tidy its memory`
          : `bot ${botId}: it wrote enough to its memory since its last dream`,
        aggregateId: botId,
        correlationId,
      }),
    );
  }

  private async lockBot(
    manager: EntityManager,
    organizationId: string,
    botId: string,
  ): Promise<boolean> {
    const locked: unknown[] = await manager.query(
      `SELECT id FROM bot WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
      [organizationId, botId],
    );
    return locked.length === 1;
  }
}

/** Whether the bot's facts are exactly the ones the dream read, each as last written. */
function sameFacts(
  current: readonly { id: string; updatedAt: Date }[],
  read: readonly { id: string; updatedAt: Date }[],
): boolean {
  if (current.length !== read.length) return false;
  const stamps = new Map(read.map((fact) => [fact.id, new Date(fact.updatedAt).getTime()]));
  return current.every((fact) => stamps.get(fact.id) === new Date(fact.updatedAt).getTime());
}
