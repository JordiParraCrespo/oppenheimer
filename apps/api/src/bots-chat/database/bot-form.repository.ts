import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { BotResource } from '../../bots/bots.resource';
import { BotFormMapper } from '../bot-form.mapper';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import type { BotFormEntity } from '../domain/bot-form.entity';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotFormOrmEntity } from './bot-form.orm-entity';
import type { BotFormRepositoryPort } from './bot-form.repository.port';
import { enqueueWithin, lockBot, waitingCardWithin } from './bot-turn.repository';

/** The insert broke `UQ_bot_form_pending`: the bot already has a form waiting. */
function isPendingTaken(error: unknown): boolean {
  const own = error as { code?: string; constraint?: string };
  const driver = (error as { driverError?: typeof own }).driverError ?? own;
  return driver.code === '23505' && driver.constraint === 'UQ_bot_form_pending';
}

@Injectable()
export class BotFormRepository
  extends ScopedRepositoryBase<BotFormOrmEntity>
  implements BotFormRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'form';

  constructor(
    @InjectRepository(BotFormOrmEntity)
    protected readonly repository: Repository<BotFormOrmEntity>,
    private readonly mapper: BotFormMapper,
    private readonly outbox: OutboxService,
    private readonly turns: BotTurnMapper,
    private readonly messages: BotMessageMapper,
  ) {
    super();
  }

  async insertPending(form: BotFormEntity): Promise<'inserted' | { waiting: string }> {
    try {
      const waiting = await this.outbox.transaction(async (manager) => {
        await lockBot(manager, form);
        const summary = await waitingCardWithin(manager, form.organizationId, form.botId);
        if (summary !== null) return summary;
        // The jsonb input is a plain object; TypeORM's partial type cannot see that.
        await manager
          .getRepository(BotFormOrmEntity)
          .insert(this.mapper.toPersistence(form) as QueryDeepPartialEntity<BotFormOrmEntity>);
        return null;
      });
      if (waiting !== null) return { waiting };
      form.markPersisted();
      return 'inserted';
    } catch (error) {
      if (isPendingTaken(error)) return { waiting: form.summary };
      throw error;
    }
  }

  async findOne(scope: AccessScope, botId: string, formId: string): Promise<Option<BotFormEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('form.botId = :botId AND form.id = :formId', { botId, formId })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findPendingBotIds(scope: AccessScope): Promise<string[]> {
    // UQ_bot_form_pending: one pending form per bot at most.
    const rows: { botId: string }[] = await this.scopedQuery(scope)
      .select('form.botId', 'botId')
      .andWhere(`form.status = 'pending'`)
      .getRawMany();
    return rows.map((row) => row.botId);
  }

  async findPending(organizationId: string, botId: string): Promise<Option<BotFormEntity>> {
    // UQ_bot_form_pending.
    const record = await this.repository.findOne({
      where: { organizationId, botId, status: 'pending' },
    });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  saveTransition(
    form: BotFormEntity,
    continuation?: { turn: BotTurnEntity; opening: BotMessageEntity },
    correlationId: string | null = null,
  ): Promise<boolean> {
    return this.outbox.transaction(async (manager) => {
      const record = this.mapper.toPersistence(form);
      const result = await manager
        .createQueryBuilder()
        .update(BotFormOrmEntity)
        .set({
          status: record.status,
          values: record.values,
          note: record.note,
          decidedByUserId: record.decidedByUserId,
          decidedWithScopes: record.decidedWithScopes,
          decidedAt: record.decidedAt,
        } as QueryDeepPartialEntity<BotFormOrmEntity>)
        .where('id = :id AND "organizationId" = :organizationId AND "status" = :at', {
          id: form.id,
          organizationId: form.organizationId,
          at: form.statusAtLoad,
        })
        .execute();
      if (result.affected !== 1) return false;
      form.markPersisted();
      if (continuation) {
        await enqueueWithin(
          manager,
          this.outbox,
          this.turns,
          this.messages,
          continuation.turn,
          continuation.opening,
          correlationId,
        );
      }
      return true;
    });
  }
}
