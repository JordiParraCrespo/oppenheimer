import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type AccessScope, ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { None, type Option, Some } from 'oxide.ts';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { BotResource } from '../../bots/bots.resource';
import { BotMessageMapper } from '../bot-message.mapper';
import { BotQuestionMapper } from '../bot-question.mapper';
import { BotTurnMapper } from '../bot-turn.mapper';
import type { BotMessageEntity } from '../domain/bot-message.entity';
import type { BotQuestionEntity } from '../domain/bot-question.entity';
import type { BotTurnEntity } from '../domain/bot-turn.entity';
import { BotQuestionOrmEntity } from './bot-question.orm-entity';
import type { BotQuestionRepositoryPort } from './bot-question.repository.port';
import { enqueueWithin, lockBot, waitingCardWithin } from './bot-turn.repository';

/** The insert broke `UQ_bot_question_pending`: the bot already has a card waiting. */
function isPendingTaken(error: unknown): boolean {
  const own = error as { code?: string; constraint?: string };
  const driver = (error as { driverError?: typeof own }).driverError ?? own;
  return driver.code === '23505' && driver.constraint === 'UQ_bot_question_pending';
}

@Injectable()
export class BotQuestionRepository
  extends ScopedRepositoryBase<BotQuestionOrmEntity>
  implements BotQuestionRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'question';

  constructor(
    @InjectRepository(BotQuestionOrmEntity)
    protected readonly repository: Repository<BotQuestionOrmEntity>,
    private readonly mapper: BotQuestionMapper,
    private readonly outbox: OutboxService,
    private readonly turns: BotTurnMapper,
    private readonly messages: BotMessageMapper,
  ) {
    super();
  }

  async insertPending(question: BotQuestionEntity): Promise<'inserted' | { waiting: string }> {
    try {
      const waiting = await this.outbox.transaction(async (manager) => {
        await lockBot(manager, question);
        const summary = await waitingCardWithin(manager, question.organizationId, question.botId);
        if (summary !== null) return summary;
        // The jsonb input is a plain object; TypeORM's partial type cannot see that.
        await manager
          .getRepository(BotQuestionOrmEntity)
          .insert(
            this.mapper.toPersistence(question) as QueryDeepPartialEntity<BotQuestionOrmEntity>,
          );
        return null;
      });
      if (waiting !== null) return { waiting };
      question.markPersisted();
      return 'inserted';
    } catch (error) {
      if (isPendingTaken(error)) return { waiting: question.summary };
      throw error;
    }
  }

  async findOne(
    scope: AccessScope,
    botId: string,
    questionId: string,
  ): Promise<Option<BotQuestionEntity>> {
    const record = await this.scopedQuery(scope)
      .andWhere('question.botId = :botId AND question.id = :questionId', { botId, questionId })
      .getOne();
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  async findPending(organizationId: string, botId: string): Promise<Option<BotQuestionEntity>> {
    // UQ_bot_question_pending.
    const record = await this.repository.findOne({
      where: { organizationId, botId, status: 'pending' },
    });
    return record ? Some(this.mapper.toDomain(record)) : None;
  }

  saveTransition(
    question: BotQuestionEntity,
    continuation?: { turn: BotTurnEntity; opening: BotMessageEntity },
    correlationId: string | null = null,
  ): Promise<boolean> {
    return this.outbox.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(BotQuestionOrmEntity)
        .set({
          status: question.status,
          answers: question.answers
            ? question.answers.map((answer) => ({ picks: [...answer.picks], other: answer.other }))
            : null,
          note: question.note,
          decidedByUserId: question.decidedByUserId,
          decidedWithScopes: question.decidedWithScopes ? [...question.decidedWithScopes] : null,
          decidedAt: question.decidedAt,
        })
        .where('id = :id AND "organizationId" = :organizationId AND "status" = :at', {
          id: question.id,
          organizationId: question.organizationId,
          at: question.statusAtLoad,
        })
        .execute();
      if (result.affected !== 1) return false;
      question.markPersisted();
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
