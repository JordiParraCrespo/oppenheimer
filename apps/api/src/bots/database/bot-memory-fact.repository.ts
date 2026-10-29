import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, Repository, type SelectQueryBuilder } from 'typeorm';
import { BotMemoryFactMapper } from '../bot-memory-fact.mapper';
import { BotResource } from '../bots.resource';
import type { BotMemoryFactEntity } from '../domain/bot-memory-fact.entity';
import { BotMemoryFactOrmEntity } from './bot-memory-fact.orm-entity';
import type { BotMemoryFactRepositoryPort } from './bot-memory-fact.repository.port';

/**
 * A bot's facts, and the `person` facts its owner's other bots keep: what
 * one bot learned about its owner, every bot of theirs reads
 * (`IDX_bot_memory_fact_bot`, `IDX_bot_memory_fact_person` by the sibling
 * bots' ids, those through `IDX_bot_created_by`). A bot with no owner has no
 * siblings.
 */
const KEPT_BY_OR_SHARED_WITH = `(fact."botId" = :botId OR (fact."scope" = 'person' AND fact."botId" IN (
  SELECT sibling.id FROM bot sibling
   WHERE sibling."organizationId" = fact."organizationId"
     AND sibling."createdByUserId" = (SELECT owner."createdByUserId" FROM bot owner WHERE owner.id = :botId)
)))`;

@Injectable()
export class BotMemoryFactRepository
  extends ScopedRepositoryBase<BotMemoryFactOrmEntity>
  implements BotMemoryFactRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'fact';

  constructor(
    @InjectRepository(BotMemoryFactOrmEntity)
    protected readonly repository: Repository<BotMemoryFactOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotMemoryFactMapper,
  ) {
    super();
  }

  async findAll(scope: AccessScope, botId: string): Promise<BotMemoryFactEntity[]> {
    return this.newestFirst(this.scopedQuery(scope).andWhere(KEPT_BY_OR_SHARED_WITH, { botId }));
  }

  async findAllForTurn(organizationId: string, botId: string): Promise<BotMemoryFactEntity[]> {
    return this.newestFirst(
      this.repository
        .createQueryBuilder('fact')
        .where('fact.organizationId = :organizationId', { organizationId })
        .andWhere(KEPT_BY_OR_SHARED_WITH, { botId }),
    );
  }

  private async newestFirst(
    query: SelectQueryBuilder<BotMemoryFactOrmEntity>,
  ): Promise<BotMemoryFactEntity[]> {
    // IDX_bot_memory_fact_bot, scanned backwards.
    const records = await query
      .orderBy('fact.createdAt', 'DESC')
      .addOrderBy('fact.id', 'DESC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(
    scope: AccessScope,
    botId: string,
    factId: string,
  ): Promise<Option<BotMemoryFactEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('fact.botId = :botId AND fact.id = :factId', { botId, factId })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(fact: BotMemoryFactEntity, max: number): Promise<'inserted' | 'full' | 'missing'> {
    return this.dataSource.transaction(async (manager) => {
      const locked: unknown[] = await manager.query(
        `SELECT id FROM bot WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
        [fact.organizationId, fact.botId],
      );
      if (locked.length === 0) return 'missing' as const;
      const [{ count }]: { count: number }[] = await manager.query(
        `SELECT count(*)::int AS count FROM bot_memory_fact
          WHERE "organizationId" = $1 AND "botId" = $2`,
        [fact.organizationId, fact.botId],
      );
      if (count >= max) return 'full' as const;
      await manager.getRepository(BotMemoryFactOrmEntity).insert(this.mapper.toPersistence(fact));
      return 'inserted' as const;
    });
  }

  async save(fact: BotMemoryFactEntity): Promise<'saved' | 'missing'> {
    const result = await this.repository
      .createQueryBuilder()
      .update(BotMemoryFactOrmEntity)
      .set({ content: fact.content, source: fact.source, tier: fact.tier, scope: fact.scope })
      .where('id = :id AND "organizationId" = :organizationId AND "botId" = :botId', {
        id: fact.id,
        organizationId: fact.organizationId,
        botId: fact.botId,
      })
      .execute();
    return result.affected === 1 ? 'saved' : 'missing';
  }

  async delete(fact: BotMemoryFactEntity): Promise<void> {
    await this.repository.delete({
      id: fact.id,
      organizationId: fact.organizationId,
      botId: fact.botId,
    });
  }

  async clear(bot: { organizationId: string; id: string }): Promise<void> {
    // At most BOT_MEMORY_FACTS_MAX rows, through IDX_bot_memory_fact_bot.
    await this.repository.delete({ organizationId: bot.organizationId, botId: bot.id });
  }
}
