import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { BotMapper } from '../bot.mapper';
import { BotDocumentMapper } from '../bot-document.mapper';
import { BotResource } from '../bots.resource';
import type { BotEntity } from '../domain/bot.entity';
import type { Placement } from '../domain/bot.types';
import type { BotDocumentEntity } from '../domain/bot-document.entity';
import { placeInOrder } from '../domain/bot-order.policy';
import { BotOrmEntity } from './bot.orm-entity';
import type { BotRepositoryPort, BotWriteOutcome } from './bot.repository.port';
import { BotDocumentOrmEntity } from './bot-document.orm-entity';
import { BotDocumentRevisionOrmEntity } from './bot-document-revision.orm-entity';

const FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class BotRepository extends ScopedRepositoryBase<BotOrmEntity> implements BotRepositoryPort {
  protected readonly resource = BotResource;
  protected readonly alias = 'bot';

  constructor(
    @InjectRepository(BotOrmEntity)
    protected readonly repository: Repository<BotOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotMapper,
    private readonly documents: BotDocumentMapper,
  ) {
    super();
  }

  async findAll(scope: AccessScope): Promise<BotEntity[]> {
    // IDX_bot_group_position.
    const records = await this.scopedQuery(scope)
      .orderBy('bot.groupId', 'ASC', 'NULLS FIRST')
      .addOrderBy('bot.position', 'ASC')
      .addOrderBy('bot.createdAt', 'ASC')
      .addOrderBy('bot.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<BotEntity>> {
    const record = await this.scopedQuery(scope).andWhere('bot.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async namesIn(scope: AccessScope): Promise<string[]> {
    const rows = await this.scopedQuery(scope).select('bot.name', 'name').getRawMany<{
      name: string;
    }>();
    return rows.map((row) => row.name);
  }

  async insert(bot: BotEntity, documents: readonly BotDocumentEntity[]): Promise<BotWriteOutcome> {
    return this.writing(async (manager) => {
      await manager.getRepository(BotOrmEntity).insert(this.mapper.toPersistence(bot));
      for (const document of documents) {
        await manager
          .getRepository(BotDocumentOrmEntity)
          .insert(this.documents.toPersistence(document));
        const revision = document.pendingRevision;
        if (revision) {
          await manager
            .getRepository(BotDocumentRevisionOrmEntity)
            .insert(this.documents.revisionToRecord(revision));
        }
      }
      if (bot.placement !== null) {
        bot.placed(await placeBot(manager, bot.organizationId, bot.groupId, bot.id, bot.placement));
      }
      for (const document of documents) document.written();
      return 'saved';
    });
  }

  async save(bot: BotEntity): Promise<BotWriteOutcome> {
    return this.writing(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(BotOrmEntity)
        .set({
          name: bot.name,
          description: bot.description,
          avatarColor: bot.avatarColor,
          groupId: bot.groupId,
          homeHostId: bot.homeHostId,
          model: bot.model,
          effort: bot.effort,
          permission: bot.permission,
          learnAutomatically: bot.learnAutomatically,
        })
        .where('id = :id AND "organizationId" = :organizationId', {
          id: bot.id,
          organizationId: bot.organizationId,
        })
        .execute();
      if (result.affected !== 1) return 'missing';
      if (bot.placement !== null) {
        bot.placed(await placeBot(manager, bot.organizationId, bot.groupId, bot.id, bot.placement));
      }
      return 'saved';
    });
  }

  async delete(bot: BotEntity): Promise<void> {
    // Documents, revisions and memory cascade with the bot (their composite keys).
    await this.repository.delete({ id: bot.id, organizationId: bot.organizationId });
  }

  /** One transaction; a group deleted under the write answers `group-missing`, not a 500. */
  private async writing(
    work: (manager: EntityManager) => Promise<BotWriteOutcome>,
  ): Promise<BotWriteOutcome> {
    try {
      return await this.dataSource.transaction(work);
    } catch (error) {
      if (violated(error, FOREIGN_KEY_VIOLATION, 'FK_bot_group')) return 'group-missing';
      throw error;
    }
  }
}

/**
 * Put `botId` at `at` among its group's bots and renumber the group 0…n-1,
 * under a lock on the group's rows so two moves into one group take turns.
 * Answers the bot's position. Only rows whose position changes are written.
 */
export async function placeBot(
  manager: EntityManager,
  organizationId: string,
  groupId: string | null,
  botId: string,
  at: Placement,
): Promise<number> {
  // IDX_bot_group_position; `IS NULL` is indexable where IS NOT DISTINCT FROM is not.
  const rows: { id: string }[] = await manager.query(
    `SELECT id FROM bot
      WHERE "organizationId" = $1 AND ${groupId === null ? '"groupId" IS NULL' : '"groupId" = $2'}
      ORDER BY "position", "createdAt", id
      FOR UPDATE`,
    groupId === null ? [organizationId] : [organizationId, groupId],
  );
  const order = placeInOrder(
    rows.map((row) => row.id),
    botId,
    at,
  );
  await renumber(manager, 'bot', order);
  return order.indexOf(botId);
}

/** Write positions 0…n-1 in `order`, touching only the rows whose position changes. */
export async function renumber(
  manager: EntityManager,
  table: 'bot' | 'bot_group',
  order: readonly string[],
): Promise<void> {
  if (order.length === 0) return;
  await manager.query(
    `UPDATE ${table} AS t SET "position" = o.ordinality - 1
       FROM unnest($1::uuid[]) WITH ORDINALITY AS o(id, ordinality)
      WHERE t.id = o.id AND t."position" <> o.ordinality - 1`,
    [order],
  );
}

export function violated(error: unknown, code: string, constraint: string): boolean {
  const driver = (error as { driverError?: { code?: string; constraint?: string } }).driverError;
  const own = error as { code?: string; constraint?: string };
  return (
    (driver?.code ?? own.code) === code && (driver?.constraint ?? own.constraint) === constraint
  );
}
