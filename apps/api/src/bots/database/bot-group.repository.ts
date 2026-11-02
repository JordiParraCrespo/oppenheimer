import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { None, type Option, Some } from 'oxide.ts';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { BotGroupMapper } from '../bot-group.mapper';
import { BotResource } from '../bots.resource';
import type { Placement } from '../domain/bot.types';
import type { BotGroupEntity } from '../domain/bot-group.entity';
import { placeInOrder } from '../domain/bot-order.policy';
import { renumber, violated } from './bot.repository';
import { BotGroupOrmEntity } from './bot-group.orm-entity';
import type { BotGroupRepositoryPort, BotGroupWriteOutcome } from './bot-group.repository.port';

const UNIQUE_VIOLATION = '23505';
const NAME_CONSTRAINT = 'UQ_bot_group_name';

@Injectable()
export class BotGroupRepository
  extends ScopedRepositoryBase<BotGroupOrmEntity>
  implements BotGroupRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'botGroup';

  constructor(
    @InjectRepository(BotGroupOrmEntity)
    protected readonly repository: Repository<BotGroupOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotGroupMapper,
  ) {
    super();
  }

  async findAll(scope: AccessScope): Promise<BotGroupEntity[]> {
    // IDX_bot_group_position_order.
    const records = await this.scopedQuery(scope)
      .orderBy('botGroup.position', 'ASC')
      .addOrderBy('botGroup.createdAt', 'ASC')
      .addOrderBy('botGroup.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findOneById(scope: AccessScope, id: string): Promise<Option<BotGroupEntity>> {
    const record = await this.scopedQuery(scope).andWhere('botGroup.id = :id', { id }).getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async insert(group: BotGroupEntity): Promise<BotGroupWriteOutcome> {
    return this.writing(group, async (manager) => {
      await manager.getRepository(BotGroupOrmEntity).insert(this.mapper.toPersistence(group));
      return 'saved';
    });
  }

  async save(group: BotGroupEntity): Promise<BotGroupWriteOutcome> {
    return this.writing(group, async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(BotGroupOrmEntity)
        .set({ name: group.name })
        .where('id = :id AND "organizationId" = :organizationId', {
          id: group.id,
          organizationId: group.organizationId,
        })
        .execute();
      return result.affected === 1 ? 'saved' : 'missing';
    });
  }

  async delete(group: BotGroupEntity): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // The ungrouped list's order is locked first, so a bot moved into it at
      // the same time takes its turn after this one. IDX_bot_group_position.
      const [{ next }]: { next: number }[] = await manager.query(
        `SELECT COALESCE(MAX("position") + 1, 0)::int AS next FROM (
           SELECT "position" FROM bot
            WHERE "organizationId" = $1 AND "groupId" IS NULL
            FOR UPDATE
         ) ungrouped`,
        [group.organizationId],
      );
      await manager.query(
        `UPDATE bot SET "groupId" = NULL, "position" = $3 + moved.ordinality - 1
           FROM unnest(ARRAY(
             SELECT id FROM bot
              WHERE "organizationId" = $1 AND "groupId" = $2
              ORDER BY "position", "createdAt", id
           )) WITH ORDINALITY AS moved(id, ordinality)
          WHERE bot.id = moved.id`,
        [group.organizationId, group.id, next],
      );
      await manager.delete(BotGroupOrmEntity, {
        id: group.id,
        organizationId: group.organizationId,
      });
    });
  }

  /** The write, then the sidebar's order when the group moved; a taken name rolls both back. */
  private async writing(
    group: BotGroupEntity,
    work: (manager: EntityManager) => Promise<BotGroupWriteOutcome>,
  ): Promise<BotGroupWriteOutcome> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const outcome = await work(manager);
        if (outcome === 'saved' && group.placement !== null) {
          group.placed(await placeGroup(manager, group.organizationId, group.id, group.placement));
        }
        return outcome;
      });
    } catch (error) {
      if (violated(error, UNIQUE_VIOLATION, NAME_CONSTRAINT)) return 'name-taken';
      throw error;
    }
  }
}

/** Put `groupId` at `at` in the workspace's sidebar and renumber the groups, under a lock. */
async function placeGroup(
  manager: EntityManager,
  organizationId: string,
  groupId: string,
  at: Placement,
): Promise<number> {
  const rows: { id: string }[] = await manager.query(
    `SELECT id FROM bot_group WHERE "organizationId" = $1
      ORDER BY "position", "createdAt", id FOR UPDATE`,
    [organizationId],
  );
  const order = placeInOrder(
    rows.map((row) => row.id),
    groupId,
    at,
  );
  await renumber(manager, 'bot_group', order);
  return order.indexOf(groupId);
}
