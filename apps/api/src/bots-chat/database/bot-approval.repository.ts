import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import type { BotApprovalStatus } from '@oppenheimer/shared';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { BotResource } from '../../bots/bots.resource';
import { BotApprovalMapper } from '../bot-approval.mapper';
import type { BotApprovalEntity } from '../domain/bot-approval.entity';
import { BotApprovalOrmEntity } from './bot-approval.orm-entity';
import type { BotApprovalRepositoryPort } from './bot-approval.repository.port';

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
  ) {
    super();
  }

  async insertPending(approval: BotApprovalEntity): Promise<'inserted' | 'pending_exists'> {
    try {
      // The jsonb input is a plain object; TypeORM's partial type cannot see that.
      await this.repository.insert(
        this.mapper.toPersistence(approval) as QueryDeepPartialEntity<BotApprovalOrmEntity>,
      );
      approval.markPersisted();
      return 'inserted';
    } catch (error) {
      if (isPendingTaken(error)) return 'pending_exists';
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

  async saveTransition(approval: BotApprovalEntity): Promise<boolean> {
    const result = await this.repository
      .createQueryBuilder()
      .update(BotApprovalOrmEntity)
      .set({
        status: approval.status,
        result: approval.result,
        note: approval.note,
        decidedByUserId: approval.decidedByUserId,
        decidedAt: approval.decidedAt,
      })
      .where('id = :id AND "organizationId" = :organizationId AND "status" = :at', {
        id: approval.id,
        organizationId: approval.organizationId,
        at: approval.statusAtLoad,
      })
      .execute();
    if (result.affected !== 1) return false;
    approval.markPersisted();
    return true;
  }
}
