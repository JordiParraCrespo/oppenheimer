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
import type { BotCreatorCheck, BotRepositoryPort, BotWriteOutcome } from './bot.repository.port';
import { BotDocumentOrmEntity } from './bot-document.orm-entity';
import { BotDocumentRevisionOrmEntity } from './bot-document-revision.orm-entity';

const FOREIGN_KEY_VIOLATION = '23503';
const UNIQUE_VIOLATION = '23505';

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

  async findForTurn(organizationId: string, botId: string): Promise<Option<BotEntity>> {
    // UQ_bot_organization_id.
    const record = await this.repository.findOne({ where: { organizationId, id: botId } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findOneByIdempotencyKey(scope: AccessScope, key: string): Promise<Option<BotEntity>> {
    // UQ_bot_organization_idempotency.
    const record = await this.scopedQuery(scope)
      .andWhere('bot.idempotencyKey = :key', { key })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async namesIn(scope: AccessScope): Promise<string[]> {
    const rows = await this.scopedQuery(scope).select('bot.name', 'name').getRawMany<{
      name: string;
    }>();
    return rows.map((row) => row.name);
  }

  async insert(
    bot: BotEntity,
    documents: readonly BotDocumentEntity[],
    creator?: BotCreatorCheck,
  ): Promise<BotWriteOutcome> {
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
      if (creator) {
        // The creator still holds the level the caller checked, and holds it
        // until this commits: `FOR SHARE` reads the level last committed and
        // makes an edit of its row wait for this transaction (UQ_bot_organization_id).
        // Taken last, after the group's rows, so it never waits holding a lock
        // a placement into the creator's own group needs first.
        const rows: { permission: string }[] = await manager.query(
          `SELECT permission FROM bot WHERE "organizationId" = $1 AND id = $2 FOR SHARE`,
          [bot.organizationId, creator.botId],
        );
        if (rows[0]?.permission !== creator.permission) {
          throw new CreatorChanged();
        }
      }
      for (const document of documents) document.written();
      return 'saved';
    });
  }

  async save(bot: BotEntity): Promise<BotWriteOutcome> {
    return this.writing(async (manager) => {
      // Only what this edit set: a concurrent edit's columns are left as it wrote them.
      const changes = Object.fromEntries(
        [...bot.editedFields].map((field) => [field, bot[field]]),
      ) as Partial<BotOrmEntity>;
      const result = await manager
        .createQueryBuilder()
        .update(BotOrmEntity)
        .set(changes)
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

  /**
   * One transaction; a group deleted under the write answers `group-missing`,
   * a creation whose idempotency key another write already used `taken`, and
   * one whose creator was deleted or changed level `creator-changed` (the
   * whole transaction rolled back), not a 500.
   */
  private async writing(
    work: (manager: EntityManager) => Promise<BotWriteOutcome>,
  ): Promise<BotWriteOutcome> {
    try {
      return await this.dataSource.transaction(work);
    } catch (error) {
      if (violated(error, FOREIGN_KEY_VIOLATION, 'FK_bot_group')) return 'group-missing';
      if (violated(error, UNIQUE_VIOLATION, 'UQ_bot_organization_idempotency')) return 'taken';
      if (error instanceof CreatorChanged) return 'creator-changed';
      if (violated(error, FOREIGN_KEY_VIOLATION, 'FK_bot_created_by_bot')) return 'creator-changed';
      throw error;
    }
  }
}

/** Rolls a creation back when its creator no longer holds the level it was checked at. */
class CreatorChanged extends Error {}

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
