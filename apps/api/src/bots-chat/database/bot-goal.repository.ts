import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { DataSource, type Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotGoalMapper } from '../bot-goal.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import type { BotGoalEntity } from '../domain/bot-goal.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import { BotGoalOrmEntity } from './bot-goal.orm-entity';
import type { BotGoalRepositoryPort } from './bot-goal.repository.port';
import { insertMessageWithin } from './bot-message.repository';

@Injectable()
export class BotGoalRepository
  extends ScopedRepositoryBase<BotGoalOrmEntity>
  implements BotGoalRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'goal';

  constructor(
    @InjectRepository(BotGoalOrmEntity)
    protected readonly repository: Repository<BotGoalOrmEntity>,
    private readonly dataSource: DataSource,
    private readonly mapper: BotGoalMapper,
    private readonly messages: BotMessageMapper,
  ) {
    super();
  }

  async findForBot(organizationId: string, botId: string): Promise<BotGoalEntity | null> {
    // UQ_bot_goal_bot.
    const record = await this.repository.findOne({ where: { organizationId, botId } });
    return record ? this.mapper.toDomain(record) : null;
  }

  set(goal: BotGoalEntity): Promise<BotGoalEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      // The old one goes first, under its row lock, so UQ_bot_goal_bot holds
      // and two sets at once leave the later one standing.
      const previous = await manager.findOne(BotGoalOrmEntity, {
        where: { organizationId: goal.organizationId, botId: goal.botId },
        lock: { mode: 'pessimistic_write' },
      });
      if (previous) await manager.delete(BotGoalOrmEntity, { id: previous.id });
      await manager.insert(BotGoalOrmEntity, this.mapper.toPersistence(goal));
      return previous ? this.mapper.toDomain(previous) : null;
    });
  }

  async advance(goal: BotGoalEntity): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update(BotGoalOrmEntity)
      .set({ continuations: goal.continuations })
      .where('id = :id AND continuations = :at', { id: goal.id, at: goal.continuationsAtLoad })
      .execute();
    if (result.affected !== 1) return false;
    goal.markPersisted();
    return true;
  }

  end(goal: BotGoalEntity, line: BotMessageEntity | null): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const result = await manager.delete(BotGoalOrmEntity, {
        id: goal.id,
        organizationId: goal.organizationId,
      });
      if (result.affected !== 1) return false;
      if (line) await insertMessageWithin(manager, this.messages, line);
      return true;
    });
  }
}
