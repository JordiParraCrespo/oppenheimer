import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { DataSource, type EntityManager, type Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotGoalMapper } from '../bot-goal.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import type { BotGoalEntity } from '../domain/bot-goal.entity';
import { GOAL_KEY_PREFIX } from '../domain/bot-goal.policy';
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
    return this.dataSource.transaction((manager) => setGoalWithin(manager, this.mapper, goal));
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

/**
 * Sets a bot's goal inside a transaction, in place of the one it has, and
 * answers the one it replaced. The old one goes first, under its row lock,
 * so UQ_bot_goal_bot holds and two sets at once leave the later one
 * standing. `BotTurnRepository.enqueueWithGoal` calls it in the transaction
 * that queues the turn setting it, after the turn's row (the origin's key).
 */
export async function setGoalWithin(
  manager: EntityManager,
  mapper: BotGoalMapper,
  goal: BotGoalEntity,
): Promise<BotGoalEntity | null> {
  const previous = await manager.findOne(BotGoalOrmEntity, {
    where: { organizationId: goal.organizationId, botId: goal.botId },
    lock: { mode: 'pessimistic_write' },
  });
  if (previous) await manager.delete(BotGoalOrmEntity, { id: previous.id });
  await manager.insert(BotGoalOrmEntity, mapper.toPersistence(goal));
  return previous ? mapper.toDomain(previous) : null;
}

/**
 * Claims the goal's next continuation inside a transaction that queues it
 * (`BotTurnRepository.enqueueContinuation`): its count, conditional on the
 * count it was loaded at. False when the goal was deleted (stopped, ended,
 * replaced) or another end claimed the count first. The row lock it takes is
 * the one a Stop's delete takes, so the two cannot both win.
 */
export async function claimContinuationWithin(
  manager: EntityManager,
  goal: BotGoalEntity,
): Promise<boolean> {
  const result = await manager
    .createQueryBuilder()
    .update(BotGoalOrmEntity)
    // A continuation queued is the end of any wait the goal was holding for.
    .set({ continuations: goal.continuations, waitingFor: null, waitingUntil: null })
    .where('id = :id AND continuations = :at', { id: goal.id, at: goal.continuationsAtLoad })
    .execute();
  if (result.affected !== 1) return false;
  goal.markPersisted();
  return true;
}

/**
 * Marks the ended turn's own goal as waiting out `limit`, in the transaction
 * that stages its held decision (`BotTurnRepository.finish`), so the row says
 * what the queue holds. Its own goal is the one it set (`originTurnId`) or
 * the one its continuation key names: a goal set in its place while it ran
 * is not held by it, and is left as it is. A goal that is gone writes nothing.
 */
export async function holdGoalWithin(
  manager: EntityManager,
  turn: { organizationId: string; botId: string; id: string; sourceKey: string | null },
  limit: { system: string; resetAt: Date },
): Promise<void> {
  // UQ_bot_goal_bot finds the bot's one row; the rest says whether it is this turn's.
  await manager.query(
    `UPDATE bot_goal SET "waitingFor" = $5, "waitingUntil" = $6, "updatedAt" = now()
      WHERE "organizationId" = $1 AND "botId" = $2
        AND ("originTurnId" = $3 OR left($4, length($7 || id::text || ':')) = $7 || id::text || ':')`,
    [
      turn.organizationId,
      turn.botId,
      turn.id,
      turn.sourceKey,
      limit.system.slice(0, 64),
      limit.resetAt,
      GOAL_KEY_PREFIX,
    ],
  );
}

/**
 * Whether a turn's end owes its bot's goal a decision: it is the turn that
 * set the goal or one of its continuations. Read in the end's transaction,
 * so a goal set in this very turn is seen (`IDX_bot_goal_origin_turn`, or the
 * key the continuation carries).
 */
export async function owesGoalWithin(
  manager: EntityManager,
  turn: { organizationId: string; botId: string; id: string; sourceKey: string | null },
): Promise<boolean> {
  if (turn.sourceKey?.startsWith(GOAL_KEY_PREFIX)) return true;
  const set: unknown[] = await manager.query(
    `SELECT 1 FROM bot_goal WHERE "organizationId" = $1 AND "originTurnId" = $2`,
    [turn.organizationId, turn.id],
  );
  return set.length > 0;
}
