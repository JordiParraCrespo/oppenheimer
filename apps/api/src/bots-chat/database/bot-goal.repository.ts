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
import type { BotRateLimit } from '../domain/bot-rate-limit.policy';
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

  pause(goal: BotGoalEntity, line: BotMessageEntity, spend: 'owed' | 'counted'): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const {
        pausedAt,
        pauseReason,
        pauseNote,
        tokensUsed,
        idleTurns,
        claim,
        waitingFor,
        waitingUntil,
      } = this.mapper.toPersistence(goal);
      const result = await manager
        .createQueryBuilder()
        .update(BotGoalOrmEntity)
        // `updatedAt` at the pause's own time while its turn's spend is owed:
        // `recordSpend` writes once while they match. Past it, nothing is owed.
        .set({
          pausedAt,
          pauseReason,
          pauseNote,
          tokensUsed,
          idleTurns,
          claim,
          waitingFor,
          waitingUntil,
          ...(pausedAt
            ? { updatedAt: spend === 'owed' ? pausedAt : new Date(pausedAt.getTime() + 1) }
            : {}),
        })
        .where('id = :id AND continuations = :at AND "pausedAt" IS NULL', {
          id: goal.id,
          at: goal.continuationsAtLoad,
        })
        .execute();
      if (result.affected !== 1) return false;
      await insertMessageWithin(manager, this.messages, line);
      goal.markPersisted();
      return true;
    });
  }

  async recordSpend(goal: BotGoalEntity): Promise<boolean> {
    const { tokensUsed, idleTurns, pausedAt } = this.mapper.toPersistence(goal);
    const result = await this.repository
      .createQueryBuilder()
      .update(BotGoalOrmEntity)
      .set({ tokensUsed, idleTurns, updatedAt: () => 'now()' })
      .where('id = :id AND "pausedAt" = :pausedAt AND "updatedAt" = "pausedAt"', {
        id: goal.id,
        pausedAt,
      })
      .execute();
    return result.affected === 1;
  }

  async claim(goal: BotGoalEntity): Promise<boolean> {
    const result = await this.repository.update(
      { id: goal.id, organizationId: goal.organizationId },
      { claim: goal.claim },
    );
    return result.affected === 1;
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
 * (`BotTurnRepository.enqueueContinuation`): its count, with what the ended
 * turn added to it (tokens, idle turns, a claim the reviewer turned down, a
 * pause the owner lifted), conditional on the count it was loaded at and on
 * it still running (or, `resuming`, still paused). False when the goal was
 * deleted (stopped, ended, replaced), paused meanwhile, or another end
 * claimed the count first. The row lock it takes is the one a Stop's delete takes,
 * so the two cannot both win.
 */
export async function claimContinuationWithin(
  manager: EntityManager,
  mapper: BotGoalMapper,
  goal: BotGoalEntity,
  /** The owner resumes a paused goal: the claim is on it still being paused, not running. */
  resuming: boolean,
): Promise<boolean> {
  // `advance` ended any wait the goal held for: the write carries what it left.
  const {
    continuations,
    waitingFor,
    waitingUntil,
    tokensUsed,
    idleTurns,
    claim,
    pausedAt,
    pauseReason,
    pauseNote,
  } = mapper.toPersistence(goal);
  const result = await manager
    .createQueryBuilder()
    .update(BotGoalOrmEntity)
    .set({
      continuations,
      waitingFor,
      waitingUntil,
      tokensUsed,
      idleTurns,
      claim,
      pausedAt,
      pauseReason,
      pauseNote,
    })
    .where(`id = :id AND continuations = :at AND "pausedAt" IS ${resuming ? 'NOT NULL' : 'NULL'}`, {
      id: goal.id,
      at: goal.continuationsAtLoad,
    })
    .execute();
  if (result.affected !== 1) return false;
  goal.markPersisted();
  return true;
}

/**
 * Holds the ended turn's own goal for `limit` (`BotGoalEntity.hold`), in the
 * transaction that stages its held decision (`BotTurnRepository.finish`), so
 * the row says what the queue holds. The bot's goal is read under the lock a
 * Stop's delete takes (`UQ_bot_goal_bot`); one the turn does not hold
 * (`isHeldBy`: a goal set in its place while it ran) is left as it is, and a
 * goal that is gone writes nothing.
 */
export async function holdGoalWithin(
  manager: EntityManager,
  mapper: BotGoalMapper,
  turn: { organizationId: string; botId: string; id: string; sourceKey: string | null },
  limit: BotRateLimit,
): Promise<void> {
  const record = await manager.findOne(BotGoalOrmEntity, {
    where: { organizationId: turn.organizationId, botId: turn.botId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!record) return;
  const goal = mapper.toDomain(record);
  // A paused goal waits on nothing; marking it would also move `updatedAt`
  // past its pause, and the spend the pause still owes would be refused.
  if (!goal.isHeldBy(turn) || goal.paused) return;
  goal.hold(limit);
  const { waitingFor, waitingUntil } = mapper.toPersistence(goal);
  await manager.update(BotGoalOrmEntity, { id: goal.id }, { waitingFor, waitingUntil });
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
