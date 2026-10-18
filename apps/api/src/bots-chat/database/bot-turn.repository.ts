import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { BOT_ACTIVE_TURN_STATUSES, QUEUE_NAMES } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import { BOT_CONVERSATION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import type { BotConversationRepositoryPort } from './bot-conversation.repository.port';
import { insertMessageWithin } from './bot-message.repository';
import { BotTurnOrmEntity } from './bot-turn.orm-entity';
import type { BotTurnRepositoryPort } from './bot-turn.repository.port';

/** The job that runs one turn; its payload is `{ turnId }`. */
export const RUN_BOT_TURN_JOB = 'run-bot-turn';

/** The claim broke `UQ_bot_turn_running`: another turn of the bot is running. */
function isRunningTaken(error: unknown): boolean {
  const own = error as { code?: string; constraint?: string };
  const driver = (error as { driverError?: typeof own }).driverError ?? own;
  return driver.code === '23505' && driver.constraint === 'UQ_bot_turn_running';
}

@Injectable()
export class BotTurnRepository
  extends ScopedRepositoryBase<BotTurnOrmEntity>
  implements BotTurnRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'turn';

  constructor(
    @InjectRepository(BotTurnOrmEntity)
    protected readonly repository: Repository<BotTurnOrmEntity>,
    private readonly outbox: OutboxService,
    private readonly mapper: BotTurnMapper,
    private readonly messages: BotMessageMapper,
    @Inject(BOT_CONVERSATION_REPOSITORY)
    private readonly conversations: BotConversationRepositoryPort,
  ) {
    super();
  }

  enqueue(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<'staged' | 'waiting' | 'missing'> {
    return this.outbox.transaction((manager) =>
      enqueueWithin(manager, this.outbox, this.mapper, this.messages, turn, message, correlationId),
    );
  }

  enqueueOnce(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
    busyPrefix: string | null,
  ): Promise<{ outcome: 'staged' | 'waiting' | 'existing' | 'busy' | 'missing'; turnId: string }> {
    if (!turn.sourceKey) throw new Error('A turn queued once carries its source key');
    return this.outbox.transaction(async (manager) => {
      if (!(await lockBot(manager, turn))) return { outcome: 'missing' as const, turnId: turn.id };
      // UQ_bot_turn_source; read under the bot's lock, so two dispatches of one
      // run cannot both miss it.
      const [existing]: { id: string }[] = await manager.query(
        `SELECT id FROM bot_turn WHERE "botId" = $1 AND "sourceKey" = $2`,
        [turn.botId, turn.sourceKey],
      );
      if (existing) return { outcome: 'existing' as const, turnId: existing.id };
      if (busyPrefix !== null) {
        // IDX_bot_turn_active: a bot's queued and running turns are a handful.
        const [active]: unknown[] = await manager.query(
          `SELECT 1 FROM bot_turn
            WHERE "organizationId" = $1 AND "botId" = $2 AND "status" IN ('queued', 'running')
              AND starts_with("sourceKey", $3)
            LIMIT 1`,
          [turn.organizationId, turn.botId, busyPrefix],
        );
        if (active) return { outcome: 'busy' as const, turnId: turn.id };
      }
      const outcome = await enqueueLocked(
        manager,
        this.outbox,
        this.mapper,
        this.messages,
        turn,
        message,
        correlationId,
      );
      return { outcome, turnId: turn.id };
    });
  }

  async findOne(scope: AccessScope, botId: string, turnId: string): Promise<Option<BotTurnEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('turn.botId = :botId AND turn.id = :turnId', { botId, turnId })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findForRun(turnId: string): Promise<Option<BotTurnEntity>> {
    const record = await this.repository.findOne({ where: { id: turnId } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findForConversation(
    scope: AccessScope,
    botId: string,
    turnIds: string[],
  ): Promise<BotTurnEntity[]> {
    // IDX_bot_turn_bot, and IDX_bot_turn_active for the second half.
    const records = await this.scopedQuery(scope)
      .andWhere('turn.botId = :botId', { botId })
      .andWhere('(turn.id = ANY(:turnIds) OR turn.status IN (:...active))', {
        turnIds,
        active: BOT_ACTIVE_TURN_STATUSES,
      })
      .orderBy('turn.createdAt', 'ASC')
      .addOrderBy('turn.id', 'ASC')
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async claim(turn: BotTurnEntity): Promise<'claimed' | 'busy' | 'lost'> {
    try {
      const result = await this.repository
        .createQueryBuilder()
        .update(BotTurnOrmEntity)
        .set({ status: turn.status, startedAt: turn.startedAt })
        .where('id = :id AND "status" = :at', { id: turn.id, at: turn.statusAtLoad })
        .execute();
      if (result.affected !== 1) return 'lost';
      turn.markPersisted();
      return 'claimed';
    } catch (error) {
      if (isRunningTaken(error)) return 'busy';
      throw error;
    }
  }

  finish(turn: BotTurnEntity, correlationId: string | null): Promise<boolean> {
    return this.outbox.transaction(async (manager) => {
      // The same lock a send takes, first: a send either commits before this
      // looks for the next queued turn, or counts this one as ended.
      await lockBot(manager, turn);
      const result = await manager
        .createQueryBuilder()
        .update(BotTurnOrmEntity)
        .set({
          status: turn.status,
          error: turn.error,
          inputTokens: turn.inputTokens,
          outputTokens: turn.outputTokens,
          endedAt: turn.endedAt,
        })
        .where('id = :id AND "status" = :at', { id: turn.id, at: turn.statusAtLoad })
        .execute();
      if (result.affected !== 1) return false;
      turn.markPersisted();
      await stageNext(this.outbox, manager, turn, correlationId);
      return true;
    });
  }

  async requestCancel(turn: BotTurnEntity, now: Date): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update(BotTurnOrmEntity)
      .set({ cancelRequestedAt: now })
      .where('id = :id AND "status" = :running', { id: turn.id, running: 'running' })
      .execute();
    return result.affected === 1;
  }

  async isCancelRequested(turnId: string): Promise<boolean> {
    const record = await this.repository.findOne({
      where: { id: turnId },
      select: { id: true, cancelRequestedAt: true },
    });
    return Boolean(record?.cancelRequestedAt);
  }

  clearConversation(
    organizationId: string,
    botId: string,
  ): Promise<'cleared' | 'busy' | 'missing'> {
    return this.outbox.transaction(async (manager) => {
      // The lock a send takes: no turn can be queued between the check and the deletes.
      if (!(await lockBot(manager, { organizationId, botId }))) return 'missing';
      // IDX_bot_turn_active.
      const [{ active }]: { active: number }[] = await manager.query(
        `SELECT count(*)::int AS active FROM bot_turn
          WHERE "organizationId" = $1 AND "botId" = $2 AND "status" IN ('queued', 'running')`,
        [organizationId, botId],
      );
      if (active > 0) return 'busy';
      await this.conversations.deleteWithin(manager, organizationId, botId);
      await manager.query(`DELETE FROM bot_turn WHERE "organizationId" = $1 AND "botId" = $2`, [
        organizationId,
        botId,
      ]);
      return 'cleared';
    });
  }
}

/**
 * `enqueue` in the caller's transaction: the turn and its opening message
 * under the lock on the bot, its job staged when nothing else of the bot's
 * is queued or running. A decision's turn is queued this way in the same
 * transaction as the decision.
 */
export async function enqueueWithin(
  manager: EntityManager,
  outbox: OutboxService,
  turns: BotTurnMapper,
  messages: BotMessageMapper,
  turn: BotTurnEntity,
  message: BotMessageEntity,
  correlationId: string | null,
): Promise<'staged' | 'waiting' | 'missing'> {
  if (!(await lockBot(manager, turn))) return 'missing';
  return enqueueLocked(manager, outbox, turns, messages, turn, message, correlationId);
}

/** `enqueueWithin` once the bot is locked. */
async function enqueueLocked(
  manager: EntityManager,
  outbox: OutboxService,
  turns: BotTurnMapper,
  messages: BotMessageMapper,
  turn: BotTurnEntity,
  message: BotMessageEntity,
  correlationId: string | null,
): Promise<'staged' | 'waiting'> {
  // IDX_bot_turn_active.
  const [{ active }]: { active: number }[] = await manager.query(
    `SELECT count(*)::int AS active FROM bot_turn
      WHERE "organizationId" = $1 AND "botId" = $2 AND "status" IN ('queued', 'running')`,
    [turn.organizationId, turn.botId],
  );
  await manager.getRepository(BotTurnOrmEntity).insert(turns.toPersistence(turn));
  await insertMessageWithin(manager, messages, message);
  if (active > 0) return 'waiting';
  await stageRun(outbox, manager, turn.botId, turn.id, correlationId);
  return 'staged';
}

/**
 * Locks the bot's row for the rest of the transaction: the one lock a send
 * and the end of a turn take turns on, so only one of them decides which
 * turn is due. `FOR NO KEY UPDATE` leaves the bot's turns free to reference
 * it. Whether the bot is still there.
 */
async function lockBot(
  manager: EntityManager,
  turn: Pick<BotTurnEntity, 'organizationId' | 'botId'>,
): Promise<boolean> {
  const bot: unknown[] = await manager.query(
    `SELECT id FROM bot WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
    [turn.organizationId, turn.botId],
  );
  return bot.length > 0;
}

/** Stages the job that runs `turnId`, in the transaction that made it due. */
async function stageRun(
  outbox: OutboxService,
  manager: EntityManager,
  botId: string,
  turnId: string,
  correlationId: string | null,
): Promise<void> {
  await outbox.stageJob(manager, {
    queue: QUEUE_NAMES.BOT_TURNS,
    jobName: RUN_BOT_TURN_JOB,
    payload: { turnId },
    reason: `bot ${botId}: turn ${turnId} is next`,
    aggregateId: turnId,
    correlationId,
  });
}

/**
 * After a turn ends, the bot's oldest queued turn is due, unless another of
 * its turns is running (that one stages the next when it ends).
 */
async function stageNext(
  outbox: OutboxService,
  manager: EntityManager,
  turn: BotTurnEntity,
  correlationId: string | null,
): Promise<void> {
  // IDX_bot_turn_active.
  const next: { id: string }[] = await manager.query(
    `SELECT id FROM bot_turn
      WHERE "organizationId" = $1 AND "botId" = $2 AND "status" = 'queued'
        AND NOT EXISTS (
          SELECT 1 FROM bot_turn r
           WHERE r."organizationId" = $1 AND r."botId" = $2 AND r."status" = 'running'
        )
      ORDER BY "createdAt", id LIMIT 1`,
    [turn.organizationId, turn.botId],
  );
  if (next[0]) await stageRun(outbox, manager, turn.botId, next[0].id, correlationId);
}
