import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import { DataSource, type EntityManager } from 'typeorm';
import { BotMemoryDreamMapper } from '../bot-memory-dream.mapper';
import type { DreamState, StoredDream } from '../domain/bot-dream.policy';
import type { BotMemoryDreamOrmEntity } from './bot-memory-dream.orm-entity';
import type {
  BotMemoryDreamRepositoryPort,
  DreamWeight,
  DreamWrite,
} from './bot-memory-dream.repository.port';

/** The job that dreams a bot's memory; its payload is `{ organizationId, botId, force }`. */
export const DREAM_BOT_MEMORY_JOB = 'dream-bot-memory';

/** How long a Tidy now reads as under way without its job settling it: a lost job does not hold the row. */
const PENDING_FOR = '10 minutes';

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

  async findState(organizationId: string, botId: string): Promise<DreamState> {
    const [row]: (DreamRow & { pending: boolean })[] = await this.dataSource.query(
      `SELECT ${DREAM_COLUMNS},
              coalesce("requestedAt" > now() - interval '${PENDING_FOR}', false) AS pending
         FROM bot_memory_dream WHERE "organizationId" = $1 AND "botId" = $2`,
      [organizationId, botId],
    );
    return { latest: row ? this.mapper.toDomain(row) : null, pending: row?.pending ?? false };
  }

  async weigh(organizationId: string, botId: string): Promise<DreamWeight> {
    const [row]: { rewritable: number; writesSince: number; lastDreamAt: Date | null }[] =
      await this.dataSource.query(
        `SELECT count(f.id) FILTER (WHERE f.source = 'bot')::int AS rewritable,
                count(f.id) FILTER (
                  WHERE greatest(f."createdAt", f."updatedAt") > coalesce(d."createdAt", '-infinity')
                )::int AS "writesSince",
                d."triedAt" AS "lastDreamAt"
           FROM (SELECT $1::uuid AS "organizationId", $2::uuid AS "botId") b
           LEFT JOIN bot_memory_dream d
             ON d."organizationId" = b."organizationId" AND d."botId" = b."botId"
           LEFT JOIN bot_memory_fact f
             ON f."organizationId" = b."organizationId" AND f."botId" = b."botId"
          GROUP BY d."createdAt", d."triedAt"`,
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
      const current = await this.lockFacts(manager, dream.organizationId, dream.botId);
      const own = current.filter((fact) => fact.source === 'bot');
      if (!sameFacts(own, dream.read)) return 'changed' as const;
      if (current.length - own.length + dream.facts.length > max) return 'changed' as const;
      const readIds = dream.read.map((fact) => fact.id);
      const outputIds = dream.facts.map(() => randomUUID());
      await this.recordDream(manager, dream, readIds, outputIds);
      await this.swapFacts(manager, dream, readIds, outputIds);
      return 'applied' as const;
    });
  }

  async undo(organizationId: string, botId: string, max: number): Promise<StoredDream | null> {
    return this.outbox.transaction(async (manager) => {
      if (!(await this.lockBot(manager, organizationId, botId))) return null;
      const [row]: DreamRow[] = await manager.query(
        `SELECT ${DREAM_COLUMNS}, "outputFactIds" FROM bot_memory_dream
          WHERE "organizationId" = $1 AND "botId" = $2 AND id IS NOT NULL AND "undoneAt" IS NULL`,
        [organizationId, botId],
      );
      if (!row) return null;
      await this.takeBackOutputs(manager, organizationId, botId, row.outputFactIds ?? []);
      await this.restoreSnapshot(manager, organizationId, botId);
      await this.trimToCap(manager, organizationId, botId, max);
      const [[undone]]: [DreamRow[], number] = await manager.query(
        `UPDATE bot_memory_dream SET "undoneAt" = now(), "updatedAt" = now()
          WHERE "organizationId" = $1 AND "botId" = $2
          RETURNING ${DREAM_COLUMNS}`,
        [organizationId, botId],
      );
      return undone ? this.mapper.toDomain(undone) : null;
    });
  }

  async stageDream(
    organizationId: string,
    botId: string,
    intervalMs: number,
    correlationId: string | null,
  ): Promise<boolean> {
    return this.outbox.transaction(async (manager) => {
      // The day's slot, claimed in the row's own write: of two turns ending
      // at once, one stages the dream and the other finds the slot taken.
      const claimed: unknown[] = await manager.query(
        `INSERT INTO bot_memory_dream ("organizationId", "botId", "triedAt")
         SELECT "organizationId", id, now() FROM bot WHERE "organizationId" = $1 AND id = $2
         ON CONFLICT ("organizationId", "botId") DO UPDATE SET "triedAt" = now(), "updatedAt" = now()
          WHERE bot_memory_dream."triedAt" <= now() - make_interval(secs => $3::double precision / 1000)
         RETURNING 1`,
        [organizationId, botId, intervalMs],
      );
      if (claimed.length === 0) return false;
      await this.stageJob(manager, organizationId, botId, false, correlationId);
      return true;
    });
  }

  async requestDream(
    organizationId: string,
    botId: string,
    correlationId: string | null,
  ): Promise<void> {
    await this.outbox.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO bot_memory_dream ("organizationId", "botId", "triedAt", "requestedAt")
         SELECT "organizationId", id, now(), now() FROM bot WHERE "organizationId" = $1 AND id = $2
         ON CONFLICT ("organizationId", "botId")
         DO UPDATE SET "triedAt" = now(), "requestedAt" = now(), "updatedAt" = now()`,
        [organizationId, botId],
      );
      await this.stageJob(manager, organizationId, botId, true, correlationId);
    });
  }

  async settle(organizationId: string, botId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE bot_memory_dream SET "requestedAt" = NULL, "updatedAt" = now()
        WHERE "organizationId" = $1 AND "botId" = $2 AND "requestedAt" IS NOT NULL`,
      [organizationId, botId],
    );
  }

  private stageJob(
    manager: EntityManager,
    organizationId: string,
    botId: string,
    force: boolean,
    correlationId: string | null,
  ): Promise<void> {
    return this.outbox.stageJob(manager, {
      queue: QUEUE_NAMES.BOT_DREAMS,
      jobName: DREAM_BOT_MEMORY_JOB,
      payload: { organizationId, botId, force },
      reason: force
        ? `bot ${botId}: its owner asked it to tidy its memory`
        : `bot ${botId}: it wrote enough to its memory since its last dream`,
      aggregateId: botId,
      correlationId,
    });
  }

  /**
   * Every fact of the bot, locked: an edit or a forget (which do not take the
   * bot's lock) either committed before and is seen here, or waits until the
   * dream's write is done and then finds its fact gone.
   */
  private lockFacts(
    manager: EntityManager,
    organizationId: string,
    botId: string,
  ): Promise<{ id: string; updatedAt: Date; source: string }[]> {
    return manager.query(
      `SELECT id, "updatedAt", source FROM bot_memory_fact
        WHERE "organizationId" = $1 AND "botId" = $2
        FOR UPDATE`,
      [organizationId, botId],
    );
  }

  /** The dream as the bot's row, with the facts it replaces as they stand (read before the swap). */
  private async recordDream(
    manager: EntityManager,
    dream: DreamWrite,
    readIds: readonly string[],
    outputIds: readonly string[],
  ): Promise<void> {
    await manager.query(
      `WITH replaced AS (
         SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f."createdAt", f.id), '[]'::jsonb) AS rows
           FROM bot_memory_fact f
          WHERE f."organizationId" = $1 AND f."botId" = $2 AND f.id = ANY($7::uuid[])
       )
       INSERT INTO bot_memory_dream
         ("organizationId", "botId", "triedAt", id, "factsBefore", "factsAfter", note,
          snapshot, "outputFactIds", "createdAt", "undoneAt", "updatedAt")
       SELECT $1, $2, now(), $3, $4, $5, $6, replaced.rows, $8::uuid[], now(), NULL, now()
         FROM replaced
       ON CONFLICT ("organizationId", "botId") DO UPDATE SET
         "triedAt" = now(), id = EXCLUDED.id, "factsBefore" = EXCLUDED."factsBefore",
         "factsAfter" = EXCLUDED."factsAfter", note = EXCLUDED.note, snapshot = EXCLUDED.snapshot,
         "outputFactIds" = EXCLUDED."outputFactIds", "createdAt" = EXCLUDED."createdAt",
         "undoneAt" = NULL, "updatedAt" = now()`,
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
  }

  /** These ids out, these rows in: the facts the dream read for the ones it wrote. */
  private async swapFacts(
    manager: EntityManager,
    dream: DreamWrite,
    readIds: readonly string[],
    outputIds: readonly string[],
  ): Promise<void> {
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
  }

  /** What the dream wrote, but not a fact of it the owner has edited since: that is theirs. */
  private async takeBackOutputs(
    manager: EntityManager,
    organizationId: string,
    botId: string,
    outputIds: readonly string[],
  ): Promise<void> {
    await manager.query(
      `DELETE FROM bot_memory_fact
        WHERE "organizationId" = $1 AND "botId" = $2 AND id = ANY($3::uuid[]) AND source = 'bot'`,
      [organizationId, botId, outputIds],
    );
  }

  /** The facts the dream replaced, back with their own ids and dates. */
  private async restoreSnapshot(
    manager: EntityManager,
    organizationId: string,
    botId: string,
  ): Promise<void> {
    await manager.query(
      `INSERT INTO bot_memory_fact (id, "organizationId", "botId", content, source, tier, scope, "createdAt", "updatedAt")
       SELECT (e->>'id')::uuid, $1, $2, e->>'content', e->>'source', e->>'tier', e->>'scope',
              (e->>'createdAt')::timestamptz, (e->>'updatedAt')::timestamptz
         FROM bot_memory_dream d, jsonb_array_elements(d.snapshot) e
        WHERE d."organizationId" = $1 AND d."botId" = $2
       ON CONFLICT (id) DO NOTHING`,
      [organizationId, botId],
    );
  }

  /** Past the cap, the bot's own oldest log facts make room; the person's never do. */
  private async trimToCap(
    manager: EntityManager,
    organizationId: string,
    botId: string,
    max: number,
  ): Promise<void> {
    await manager.query(
      `DELETE FROM bot_memory_fact WHERE id IN (
         SELECT id FROM bot_memory_fact
          WHERE "organizationId" = $1 AND "botId" = $2 AND tier = 'log' AND source = 'bot'
          ORDER BY "createdAt", id
          LIMIT greatest((SELECT count(*) FROM bot_memory_fact
                           WHERE "organizationId" = $1 AND "botId" = $2) - $3, 0))`,
      [organizationId, botId, max],
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
