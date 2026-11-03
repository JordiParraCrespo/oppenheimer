import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { EntityManager, Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotLoopMapper } from '../bot-loop.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import type { BotLoopEntity } from '../domain/bot-loop.entity';
import { LOOP_KEY_PREFIX } from '../domain/bot-loop.policy';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import { BotLoopOrmEntity } from './bot-loop.orm-entity';
import type { BotLoopRepositoryPort } from './bot-loop.repository.port';
import { insertMessageWithin } from './bot-message.repository';

/** The job that runs a loop's next run when it is due; its payload is `{ loopId, run, at }`. */
export const RUN_BOT_LOOP_JOB = 'run-bot-loop';

@Injectable()
export class BotLoopRepository
  extends ScopedRepositoryBase<BotLoopOrmEntity>
  implements BotLoopRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'loop';

  constructor(
    @InjectRepository(BotLoopOrmEntity)
    protected readonly repository: Repository<BotLoopOrmEntity>,
    private readonly outbox: OutboxService,
    private readonly mapper: BotLoopMapper,
    private readonly messages: BotMessageMapper,
  ) {
    super();
  }

  async findForBot(organizationId: string, botId: string): Promise<BotLoopEntity | null> {
    // UQ_bot_loop_bot.
    const record = await this.repository.findOne({ where: { organizationId, botId } });
    return record ? this.mapper.toDomain(record) : null;
  }

  async findForRun(loopId: string): Promise<BotLoopEntity | null> {
    // PK_bot_loop.
    const record = await this.repository.findOne({ where: { id: loopId } });
    return record ? this.mapper.toDomain(record) : null;
  }

  schedule(loop: BotLoopEntity, at: Date, correlationId: string | null): Promise<boolean> {
    return this.outbox.transaction(async (manager) => {
      loop.moveNext(at);
      // The count only: a self-paced run may say again, and the later word wins.
      const result = await manager
        .createQueryBuilder()
        .update(BotLoopOrmEntity)
        .set({ nextRunAt: at })
        .where('id = :id AND runs = :runs', { id: loop.id, runs: loop.runsAtLoad })
        .execute();
      if (result.affected !== 1) return false;
      loop.markPersisted();
      await stageLoopRunWithin(this.outbox, manager, loop, correlationId);
      return true;
    });
  }

  end(loop: BotLoopEntity, line: BotMessageEntity | null, ifUnchanged = false): Promise<boolean> {
    return this.outbox.transaction(async (manager) => {
      const query = manager
        .createQueryBuilder()
        .delete()
        .from(BotLoopOrmEntity)
        .where('id = :id AND "organizationId" = :organizationId', {
          id: loop.id,
          organizationId: loop.organizationId,
        });
      if (ifUnchanged) {
        query.andWhere('runs = :runs AND "nextRunAt" IS NOT DISTINCT FROM :at', {
          runs: loop.runsAtLoad,
          at: loop.nextRunAtLoad,
        });
      }
      const result = await query.execute();
      if (result.affected !== 1) return false;
      if (line) await insertMessageWithin(manager, this.messages, line);
      return true;
    });
  }
}

/**
 * Sets a bot's loop inside a transaction, in place of the one it has, and
 * answers the one it replaced, with its first scheduled run staged. The old
 * one goes first, under its row lock, so UQ_bot_loop_bot holds and two sets
 * at once leave the later one standing; its staged run finds the loop gone.
 * `BotTurnRepository.enqueueWithLoop` calls it in the transaction that
 * queues the turn setting it, after the turn's row (the origin's key).
 */
export async function setLoopWithin(
  outbox: OutboxService,
  manager: EntityManager,
  mapper: BotLoopMapper,
  loop: BotLoopEntity,
  correlationId: string | null,
): Promise<BotLoopEntity | null> {
  const previous = await manager.findOne(BotLoopOrmEntity, {
    where: { organizationId: loop.organizationId, botId: loop.botId },
    lock: { mode: 'pessimistic_write' },
  });
  if (previous) await manager.delete(BotLoopOrmEntity, { id: previous.id });
  await manager.insert(BotLoopOrmEntity, mapper.toPersistence(loop));
  await stageLoopRunWithin(outbox, manager, loop, correlationId);
  return previous ? mapper.toDomain(previous) : null;
}

/**
 * Claims what a run's job decided, inside the transaction that acts on it:
 * the count and the next run, conditional on both as they were loaded. False
 * when the loop was deleted (stopped, ended, replaced) or another dispatch,
 * or the bot's `schedule_loop`, moved it first. The row lock it takes is the
 * one a Stop's delete takes, so the two cannot both win.
 */
export async function claimLoopWithin(
  manager: EntityManager,
  loop: BotLoopEntity,
): Promise<boolean> {
  const result = await manager
    .createQueryBuilder()
    .update(BotLoopOrmEntity)
    .set({ runs: loop.runs, nextRunAt: loop.nextRunAt })
    .where('id = :id AND runs = :runs AND "nextRunAt" IS NOT DISTINCT FROM :at', {
      id: loop.id,
      runs: loop.runsAtLoad,
      at: loop.nextRunAtLoad,
    })
    .execute();
  if (result.affected !== 1) return false;
  loop.markPersisted();
  return true;
}

/** Stages the loop's next run at its due time, when it has one, in the transaction that set it. */
export async function stageLoopRunWithin(
  outbox: OutboxService,
  manager: EntityManager,
  loop: BotLoopEntity,
  correlationId: string | null,
): Promise<void> {
  const at = loop.nextRunAt;
  if (!at) return;
  await outbox.stageJob(manager, {
    queue: QUEUE_NAMES.BOT_TURNS,
    jobName: RUN_BOT_LOOP_JOB,
    payload: { loopId: loop.id, run: loop.runs + 1, at: at.toISOString() },
    reason: `bot ${loop.botId}: loop ${loop.id} run ${loop.runs + 1} is due`,
    aggregateId: loop.id,
    correlationId,
    availableAt: at,
  });
}

/**
 * Whether a turn's end owes its bot's loop a decision: it is the turn that
 * set the loop or one of its runs. Read in the end's transaction, so a loop
 * set in this very turn is seen (`IDX_bot_loop_origin_turn`, or the key the
 * run carries).
 */
export async function owesLoopWithin(
  manager: EntityManager,
  turn: { organizationId: string; id: string; sourceKey: string | null },
): Promise<boolean> {
  if (turn.sourceKey?.startsWith(LOOP_KEY_PREFIX)) return true;
  const set: unknown[] = await manager.query(
    `SELECT 1 FROM bot_loop WHERE "organizationId" = $1 AND "originTurnId" = $2`,
    [turn.organizationId, turn.id],
  );
  return set.length > 0;
}
