import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { BOT_ACTIVE_TURN_STATUSES, QUEUE_NAMES } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { type EntityManager, Repository } from 'typeorm';
import { ScopedRepositoryBase } from '../../authz/database/scoped.repository';
import { type AccessScope } from '../../authz/domain/access-scope.types';
import { BotResource } from '../../bots/bots.resource';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import { BOT_CONVERSATION_REPOSITORY } from '../bots-chat.di-tokens';
import type { BotChainState, BotChainVerdict } from '../domain/bot-chain.policy';
import type { BotGoalEntity } from '../domain/bot-goal.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnContext, BotTurnEntity } from '../domain/bot-turn.entity';
import { claimAttachmentsWithin } from './bot-attachment.repository';
import type { BotConversationRepositoryPort } from './bot-conversation.repository.port';
import { claimContinuationWithin, owesGoalWithin } from './bot-goal.repository';
import { insertMessageWithin } from './bot-message.repository';
import { BotTurnOrmEntity } from './bot-turn.orm-entity';
import type { BotPeerEnqueueOutcome, BotTurnRepositoryPort } from './bot-turn.repository.port';

/** The job that runs one turn; its payload is `{ turnId }`. */
export const RUN_BOT_TURN_JOB = 'run-bot-turn';

/** The job that queues an ask's answer on the bot that asked; its payload is `{ turnId }`, the asked turn. */
export const DELIVER_BOT_ANSWER_JOB = 'deliver-bot-answer';
/** A turn of a bot with a goal ended: the goal decides whether to go on (`25-bots.md` §4.1). */
export const CONTINUE_BOT_GOAL_JOB = 'continue-bot-goal';

/** The order lanes run in (`BotQueueLanes`), as SQL over `bot_turn."lane"`. */
const LANE_ORDER = `CASE "lane" WHEN 'owner' THEN 0 WHEN 'bots' THEN 1 ELSE 2 END`;

/** The claim broke `UQ_bot_turn_running`: another turn of the bot is running. */
function isRunningTaken(error: unknown): boolean {
  return isUniqueViolation(error, 'UQ_bot_turn_running');
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  const own = error as { code?: string; constraint?: string };
  const driver = (error as { driverError?: typeof own }).driverError ?? own;
  return driver.code === '23505' && driver.constraint === constraint;
}

/**
 * One of the message's images could not be claimed (`claimAttachmentsWithin`):
 * thrown inside the enqueue's transaction, because a throw is what rolls the
 * turn and its message back, and caught outside it as `attachments_taken`.
 */
class AttachmentsTaken extends Error {}

/** The message's images, claimed for it as the turn's sender, at the send. */
function claimAttachmentsTo(
  manager: EntityManager,
  turn: BotTurnEntity,
  message: BotMessageEntity,
): Promise<boolean> {
  if (message.attachments.length === 0) return Promise.resolve(true);
  if (!turn.requestedByUserId) return Promise.resolve(false);
  return claimAttachmentsWithin(manager, message, turn.requestedByUserId, new Date());
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

  async enqueue(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<'staged' | 'waiting' | 'missing' | 'attachments_taken'> {
    try {
      return await this.outbox.transaction(async (manager) => {
        const outcome = await enqueueWithin(
          manager,
          this.outbox,
          this.mapper,
          this.messages,
          turn,
          message,
          correlationId,
        );
        if (outcome !== 'missing' && !(await claimAttachmentsTo(manager, turn, message))) {
          throw new AttachmentsTaken();
        }
        return outcome;
      });
    } catch (error) {
      if (error instanceof AttachmentsTaken) return 'attachments_taken';
      throw error;
    }
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

  enqueueContinuation(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
    goal: BotGoalEntity,
  ): Promise<'staged' | 'waiting' | 'existing' | 'lost' | 'missing'> {
    return this.outbox.transaction(async (manager) => {
      if (!(await lockBot(manager, turn))) return 'missing';
      // UQ_bot_turn_source: this continuation was queued, and counted, already.
      const [existing]: unknown[] = await manager.query(
        `SELECT 1 FROM bot_turn WHERE "botId" = $1 AND "sourceKey" = $2`,
        [turn.botId, turn.sourceKey],
      );
      if (existing) return 'existing';
      // The goal's count and its turn commit together, or neither does.
      if (!(await claimContinuationWithin(manager, goal))) return 'lost';
      return enqueueLocked(
        manager,
        this.outbox,
        this.mapper,
        this.messages,
        turn,
        message,
        correlationId,
      );
    });
  }

  enqueueFromBot(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
    decide: (state: BotChainState) => BotChainVerdict,
  ): Promise<BotPeerEnqueueOutcome> {
    const chainId = turn.chainId;
    if (!chainId) throw new Error('A turn a bot queues belongs to a chain');
    return this.outbox.transaction(async (manager) => {
      // The chain's lock: two asks of one chain decide one after the other.
      const root: unknown[] = await manager.query(
        `SELECT id FROM bot_turn WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
        [turn.organizationId, chainId],
      );
      if (root.length === 0) return { outcome: 'chain_gone' };
      const verdict = decide(await chainStateWithin(manager, turn.organizationId, chainId));
      if (!verdict.allowed) return { outcome: 'refused', refusal: verdict.refusal };
      const queued = await enqueueWithin(
        manager,
        this.outbox,
        this.mapper,
        this.messages,
        turn,
        message,
        correlationId,
      );
      return { outcome: queued };
    });
  }

  async enqueueAnswer(
    turn: BotTurnEntity,
    message: BotMessageEntity,
    correlationId: string | null,
  ): Promise<'staged' | 'waiting' | 'missing' | 'duplicate'> {
    try {
      return await this.outbox.transaction((manager) =>
        enqueueWithin(
          manager,
          this.outbox,
          this.mapper,
          this.messages,
          turn,
          message,
          correlationId,
        ),
      );
    } catch (error) {
      if (isUniqueViolation(error, 'UQ_bot_turn_answers')) return 'duplicate';
      throw error;
    }
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

  async findQueuedBySourcePrefix(
    organizationId: string,
    botId: string,
    prefix: string,
  ): Promise<BotTurnEntity[]> {
    // IDX_bot_turn_bot narrows to the bot; its queued turns are a handful.
    const records = await this.repository
      .createQueryBuilder('turn')
      .where('turn.organizationId = :organizationId AND turn.botId = :botId', {
        organizationId,
        botId,
      })
      .andWhere(`turn.status = 'queued' AND starts_with(turn."sourceKey", :prefix)`, { prefix })
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findLastContext(organizationId: string, botId: string): Promise<BotTurnContext | null> {
    // IDX_bot_turn_bot, read backwards from the newest turn.
    const record = await this.repository
      .createQueryBuilder('turn')
      .where('turn.organizationId = :organizationId AND turn.botId = :botId', {
        organizationId,
        botId,
      })
      .andWhere('turn.contextTokens IS NOT NULL')
      .orderBy('turn.createdAt', 'DESC')
      .addOrderBy('turn.id', 'DESC')
      .getOne();
    return record ? this.mapper.toDomain(record).context : null;
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
    // The stored shape of what the turn ended with is the mapper's.
    const record = this.mapper.toPersistence(turn);
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
          failure: turn.failure,
          inputTokens: turn.inputTokens,
          outputTokens: turn.outputTokens,
          contextTokens: record.contextTokens,
          contextWindow: record.contextWindow,
          planLimits: record.planLimits,
          endedAt: turn.endedAt,
        })
        .where('id = :id AND "status" = :at', { id: turn.id, at: turn.statusAtLoad })
        .execute();
      if (result.affected !== 1) return false;
      turn.markPersisted();
      await stageNext(this.outbox, manager, turn, correlationId);
      if (turn.replyRequested && turn.askedByTurnId) {
        await this.outbox.stageJob(manager, {
          queue: QUEUE_NAMES.BOT_TURNS,
          jobName: DELIVER_BOT_ANSWER_JOB,
          payload: { turnId: turn.id },
          reason: `bot ${turn.botId}: turn ${turn.id} answers turn ${turn.askedByTurnId}`,
          aggregateId: turn.id,
          correlationId,
        });
      }
      // A goal's own turn owes it a decision, staged with the end that owes it.
      if (await owesGoalWithin(manager, turn)) {
        await this.outbox.stageJob(manager, {
          queue: QUEUE_NAMES.BOT_TURNS,
          jobName: CONTINUE_BOT_GOAL_JOB,
          payload: { turnId: turn.id },
          reason: `bot ${turn.botId}: turn ${turn.id} ended with a goal open`,
          aggregateId: turn.id,
          correlationId,
        });
      }
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
export async function lockBot(
  manager: EntityManager,
  turn: Pick<BotTurnEntity, 'organizationId' | 'botId'>,
): Promise<boolean> {
  const bot: unknown[] = await manager.query(
    `SELECT id FROM bot WHERE "organizationId" = $1 AND id = $2 FOR NO KEY UPDATE`,
    [turn.organizationId, turn.botId],
  );
  return bot.length > 0;
}

/**
 * The line of the card the bot has waiting, of either kind, or null: a bot
 * has one card up at a time, an approval or a card of questions
 * (`25-bots.md` §5). Read under `lockBot`, so two cards raised at once see
 * each other.
 */
export async function waitingCardWithin(
  manager: EntityManager,
  organizationId: string,
  botId: string,
): Promise<string | null> {
  // UQ_bot_approval_pending, UQ_bot_question_pending.
  const rows: { summary: string }[] = await manager.query(
    `SELECT summary FROM bot_approval WHERE "organizationId" = $1 AND "botId" = $2 AND status = 'pending'
     UNION ALL
     SELECT summary FROM bot_question WHERE "organizationId" = $1 AND "botId" = $2 AND status = 'pending'
     LIMIT 1`,
    [organizationId, botId],
  );
  return rows[0]?.summary ?? null;
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
 * After a turn ends, the bot's next queued turn is due, unless another of its
 * turns is running (that one stages the next when it ends): the oldest of the
 * first lane that has one (`BotQueueLanes`), so your messages go before what
 * other bots sent.
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
      ORDER BY ${LANE_ORDER}, "createdAt", id LIMIT 1`,
    [turn.organizationId, turn.botId],
  );
  if (next[0]) await stageRun(outbox, manager, turn.botId, next[0].id, correlationId);
}

/**
 * What a chain holds, read under its lock (`BotChainPolicy`): the bots of its
 * turns, the first one's included, and how many turns bots queued on other
 * bots in it, answers to asks not counted.
 */
async function chainStateWithin(
  manager: EntityManager,
  organizationId: string,
  chainId: string,
): Promise<BotChainState> {
  // PK_bot_turn for the first turn, IDX_bot_turn_chain for the rest; an OR
  // of the two would scan the workspace's turns instead.
  const bots: { botId: string }[] = await manager.query(
    `SELECT "botId" FROM bot_turn WHERE id = $2 AND "organizationId" = $1
     UNION
     SELECT "botId" FROM bot_turn WHERE "organizationId" = $1 AND "chainId" = $2`,
    [organizationId, chainId],
  );
  // IDX_bot_turn_chain.
  const [{ asks }]: { asks: number }[] = await manager.query(
    `SELECT count(*)::int AS asks FROM bot_turn
      WHERE "organizationId" = $1 AND "chainId" = $2 AND "lane" = 'bots' AND "answersTurnId" IS NULL`,
    [organizationId, chainId],
  );
  return { bots: bots.map((row) => row.botId), asks };
}
