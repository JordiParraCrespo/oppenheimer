import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { AppError } from '@oppenheimer/backend-core';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { type BotApprovalStatus, QUEUE_NAMES } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import type { EntityManager } from 'typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { BotResource } from '../../bots/bots.resource';
import { BotErrors } from '../../bots/domain/bots.errors';
import { BotApprovalMapper } from '../bot-approval.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotToolPermissionMapper } from '../bot-tool-permission.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import type { BotApprovalEntity } from '../domain/bot-approval.entity';
import { BotApprovalOrmEntity } from './bot-approval.orm-entity';
import type { BotApprovalEffects, BotApprovalRepositoryPort } from './bot-approval.repository.port';
import { insertGrantWithin, upsertDecisionWithin } from './bot-tool-permission.repository';
import { enqueueWithin, lockBot, waitingCardWithin } from './bot-turn.repository';

/** The job that carries out an approved call; its payload is `{ approvalId, by }`. */
export const RUN_APPROVED_CALL_JOB = 'run-approved-call';

/** The insert broke `UQ_bot_approval_pending`: the bot already has a card waiting. */
function isPendingTaken(error: unknown): boolean {
  const own = error as { code?: string; constraint?: string };
  const driver = (error as { driverError?: typeof own }).driverError ?? own;
  return driver.code === '23505' && driver.constraint === 'UQ_bot_approval_pending';
}

@Injectable()
export class BotApprovalRepository
  extends ScopedRepositoryBase<BotApprovalOrmEntity>
  implements BotApprovalRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'approval';

  constructor(
    @InjectRepository(BotApprovalOrmEntity)
    protected readonly repository: Repository<BotApprovalOrmEntity>,
    private readonly mapper: BotApprovalMapper,
    private readonly outbox: OutboxService,
    private readonly turns: BotTurnMapper,
    private readonly messages: BotMessageMapper,
    private readonly permissions: BotToolPermissionMapper,
  ) {
    super();
  }

  async insertPending(approval: BotApprovalEntity): Promise<'inserted' | { waiting: string }> {
    try {
      const waiting = await this.outbox.transaction(async (manager) => {
        await lockBot(manager, approval);
        const summary = await waitingCardWithin(manager, approval.organizationId, approval.botId);
        if (summary !== null) return summary;
        // The jsonb input is a plain object; TypeORM's partial type cannot see that.
        await manager
          .getRepository(BotApprovalOrmEntity)
          .insert(
            this.mapper.toPersistence(approval) as QueryDeepPartialEntity<BotApprovalOrmEntity>,
          );
        await this.outbox.stageEvents(manager, approval.domainEvents);
        return null;
      });
      if (waiting !== null) return { waiting };
      approval.clearEvents();
      approval.markPersisted();
      return 'inserted';
    } catch (error) {
      if (isPendingTaken(error)) return { waiting: approval.summary };
      throw error;
    }
  }

  async findOne(
    scope: AccessScope,
    botId: string,
    approvalId: string,
  ): Promise<Option<BotApprovalEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('approval.botId = :botId AND approval.id = :approvalId', { botId, approvalId })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findForRun(approvalId: string): Promise<Option<BotApprovalEntity>> {
    const record = await this.repository.findOne({ where: { id: approvalId } });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findPending(organizationId: string, botId: string): Promise<Option<BotApprovalEntity>> {
    // UQ_bot_approval_pending.
    const record = await this.repository.findOne({
      where: { organizationId, botId, status: 'pending' },
    });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findForBot(
    scope: AccessScope,
    botId: string,
    status: BotApprovalStatus | undefined,
    limit: number,
  ): Promise<BotApprovalEntity[]> {
    // IDX_bot_approval_bot, read backwards.
    const query = this.scopedQuery(scope).andWhere('approval.botId = :botId', { botId });
    if (status) query.andWhere('approval.status = :status', { status });
    const records = await query
      .orderBy('approval.createdAt', 'DESC')
      .addOrderBy('approval.id', 'DESC')
      .take(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async findInWorkspace(
    scope: AccessScope,
    status: BotApprovalStatus,
    limit: number,
  ): Promise<BotApprovalEntity[]> {
    // IDX_bot_approval_org_status, read backwards.
    const records = await this.scopedQuery(scope)
      .andWhere('approval.status = :status', { status })
      .orderBy('approval.createdAt', 'DESC')
      .addOrderBy('approval.id', 'DESC')
      .take(limit)
      .getMany();
    return records.map((record) => this.mapper.toDomain(record));
  }

  saveTransition(
    approval: BotApprovalEntity,
    effects: BotApprovalEffects = {},
    correlationId: string | null = null,
  ): Promise<boolean> {
    return this.outbox.transaction(async (manager) => {
      const update = manager
        .createQueryBuilder()
        .update(BotApprovalOrmEntity)
        .set({
          status: approval.status,
          result: approval.result,
          sessionId: approval.sessionId,
          note: approval.note,
          decidedByUserId: approval.decidedByUserId,
          decidedWithScopes: approval.decidedWithScopes ? [...approval.decidedWithScopes] : null,
          decidedAt: approval.decidedAt,
          reach: approval.reach,
        })
        .where('id = :id AND "organizationId" = :organizationId AND "status" = :at', {
          id: approval.id,
          organizationId: approval.organizationId,
          at: approval.statusAtLoad,
        });
      // An approved call's result is written once: a retried job finds it there and stops.
      if (approval.statusAtLoad === 'approved') update.andWhere('"result" IS NULL');
      const result = await update.execute();
      if (result.affected !== 1) return false;
      await this.outbox.stageEvents(manager, approval.domainEvents);
      approval.clearEvents();
      approval.markPersisted();
      if (effects.standing) await this.writeStanding(manager, effects.standing);
      if (effects.continuation) {
        const { turn, opening } = effects.continuation;
        await enqueueWithin(
          manager,
          this.outbox,
          this.turns,
          this.messages,
          turn,
          opening,
          correlationId,
        );
      }
      if (effects.runCall) {
        await this.outbox.stageJob(manager, {
          queue: QUEUE_NAMES.BOT_APPROVALS,
          jobName: RUN_APPROVED_CALL_JOB,
          payload: { approvalId: approval.id, by: effects.runCall.by },
          reason: `bot ${approval.botId}: approval ${approval.id} was approved`,
          aggregateId: approval.id,
          correlationId,
        });
      }
      return true;
    });
  }

  /** A grant past the cap throws, so the whole decision rolls back and the card stays open. */
  private async writeStanding(
    manager: EntityManager,
    { permission, maxGrants }: NonNullable<BotApprovalEffects['standing']>,
  ): Promise<void> {
    const record = this.permissions.toPersistence(permission);
    if (!permission.subject) {
      await upsertDecisionWithin(manager, record);
      return;
    }
    if ((await insertGrantWithin(manager, record, maxGrants)) === 'full') {
      throw new AppError(BotErrors.TOOL_GRANTS_FULL);
    }
  }
}
