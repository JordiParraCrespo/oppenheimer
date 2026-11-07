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
const OWNER_OF_BOT = `SELECT owner."createdByUserId" FROM bot owner WHERE owner.id = :botId`;
/** Every bot that person made in the fact's workspace, the bot itself among them. */
const OWNERS_BOTS = `SELECT sibling.id FROM bot sibling
   WHERE sibling."organizationId" = fact."organizationId"
     AND sibling."createdByUserId" = (${OWNER_OF_BOT})`;
/** The bot's own facts, and the facts about its owner that any bot of theirs keeps. */
const KEPT_BY_OR_SHARED_WITH = `(fact."botId" = :botId OR (fact."scope" = 'person' AND fact."botId" IN (${OWNERS_BOTS})))`;

/** Every bot the caller made in the fact's workspace. */
const CALLERS_BOTS = `SELECT mine.id FROM bot mine
   WHERE mine."organizationId" = fact."organizationId" AND mine."createdByUserId" = :userId`;

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

  async findAboutPerson(scope: AccessScope): Promise<BotMemoryFactEntity[]> {
    // IDX_bot_memory_fact_person, by the ids of the caller's bots (IDX_bot_created_by).
    return this.newestFirst(
      this.scopedQuery(scope).andWhere(
        `fact."scope" = 'person' AND fact."botId" IN (${CALLERS_BOTS})`,
        { userId: scope.userId },
      ),
    );
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

  async insert(
    fact: BotMemoryFactEntity,
    max: number,
    makeRoom = false,
  ): Promise<'inserted' | 'full' | 'missing'> {
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
      if (count >= max) {
        if (!makeRoom) return 'full' as const;
        // The oldest log fact, through IDX_bot_memory_fact_bot.
        const [, dropped]: [unknown[], number] = await manager.query(
          `DELETE FROM bot_memory_fact WHERE id = (
             SELECT id FROM bot_memory_fact
              WHERE "organizationId" = $1 AND "botId" = $2 AND tier = 'log'
              ORDER BY "createdAt", id LIMIT 1)`,
          [fact.organizationId, fact.botId],
        );
        if (dropped === 0) return 'full' as const;
      }
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
    await this.dataSource.transaction(async (manager) => {
      // The lock a dream and its undo take, so neither writes between these deletes.
      await manager.query(
        `SELECT id FROM bot WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
        [bot.organizationId, bot.id],
      );
      // At most BOT_MEMORY_FACTS_MAX rows, through IDX_bot_memory_fact_bot.
      await manager.delete(BotMemoryFactOrmEntity, {
        organizationId: bot.organizationId,
        botId: bot.id,
      });
      // The bot's latest dream, by its key: undoing it would bring cleared facts back.
      await manager.query(
        `DELETE FROM bot_memory_dream WHERE "organizationId" = $1 AND "botId" = $2`,
        [bot.organizationId, bot.id],
      );
    });
  }
}
