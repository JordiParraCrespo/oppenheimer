import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ScopedRepositoryBase } from '@oppenheimer/backend-authz';
import { OutboxService } from '@oppenheimer/backend-ddd';
import { QUEUE_NAMES } from '@oppenheimer/shared';
import type { Repository } from 'typeorm';
import { BotResource } from '../../bots/bots.resource';
import { BotSubscriptionMapper } from '../bot-subscription.mapper';
import type { BotSubscriptionEntity } from '../domain/bot-subscription.entity';
import { BotSubscriptionOrmEntity } from './bot-subscription.orm-entity';
import type { BotSubscriptionRepositoryPort } from './bot-subscription.repository.port';

/** The job that checks a handed-off task got going; its payload is `{ subscriptionId, turn }`. */
export const CHECK_STALLED_SESSION_JOB = 'check-stalled-session';

@Injectable()
export class BotSubscriptionRepository
  extends ScopedRepositoryBase<BotSubscriptionOrmEntity>
  implements BotSubscriptionRepositoryPort
{
  protected readonly resource = BotResource;
  protected readonly alias = 'subscription';

  constructor(
    @InjectRepository(BotSubscriptionOrmEntity)
    protected readonly repository: Repository<BotSubscriptionOrmEntity>,
    private readonly outbox: OutboxService,
    private readonly mapper: BotSubscriptionMapper,
  ) {
    super();
  }

  async subscribe(subscription: BotSubscriptionEntity): Promise<BotSubscriptionEntity> {
    const record = this.mapper.toPersistence(subscription);
    // UQ_bot_subscription_bot_resource. A second subscribe replaces what is
    // followed and why, and keeps the id, the newest wake recorded (the
    // newer of the two) and the count, so subscribing again never resets
    // the wake limit or re-wakes for a state already told. An INSERT
    // answers its rows (typeorm.md).
    const rows: BotSubscriptionOrmEntity[] = await this.repository.query(
      `INSERT INTO bot_subscription AS s
         ("id", "organizationId", "botId", "resourceKind", "resourceId", "originTurnId", "purpose",
          "until", "watchedTurn", "credentialScopes", "timeZone", "lastTurn", "lastState")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT ("organizationId", "botId", "resourceKind", "resourceId") DO UPDATE
         SET "originTurnId" = EXCLUDED."originTurnId",
             "purpose" = COALESCE(EXCLUDED."purpose", s."purpose"),
             "until" = EXCLUDED."until",
             "watchedTurn" = EXCLUDED."watchedTurn",
             "credentialScopes" = EXCLUDED."credentialScopes",
             "timeZone" = EXCLUDED."timeZone",
             "lastTurn" = CASE WHEN s."lastTurn" IS NULL OR EXCLUDED."lastTurn" > s."lastTurn"
                               THEN COALESCE(EXCLUDED."lastTurn", s."lastTurn") ELSE s."lastTurn" END,
             "lastState" = CASE WHEN s."lastTurn" IS NULL OR EXCLUDED."lastTurn" > s."lastTurn"
                                THEN COALESCE(EXCLUDED."lastState", s."lastState") ELSE s."lastState" END,
             "version" = s."version" + 1,
             "updatedAt" = now()
       RETURNING *`,
      [
        record.id,
        record.organizationId,
        record.botId,
        record.resourceKind,
        record.resourceId,
        record.originTurnId,
        record.purpose,
        record.until,
        record.watchedTurn,
        record.credentialScopes === null ? null : JSON.stringify(record.credentialScopes),
        record.timeZone,
        record.lastTurn,
        record.lastState,
      ],
    );
    return this.mapper.toDomain(this.repository.create(rows[0]));
  }

  async findForWake(subscriptionId: string): Promise<BotSubscriptionEntity | null> {
    // PK_bot_subscription.
    const record = await this.repository.findOne({ where: { id: subscriptionId } });
    return record ? this.mapper.toDomain(record) : null;
  }

  async findIdsForSession(organizationId: string, sessionId: string): Promise<string[]> {
    // IDX_bot_subscription_resource.
    const records = await this.repository.find({
      select: { id: true },
      where: { organizationId, resourceKind: 'session', resourceId: sessionId },
    });
    return records.map((record) => record.id);
  }

  async findForBot(
    organizationId: string,
    botId: string,
    limit: number,
  ): Promise<BotSubscriptionEntity[]> {
    // UQ_bot_subscription_bot_resource; a bot follows at most a few dozen.
    const records = await this.repository.find({
      where: { organizationId, botId },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: limit,
    });
    return records.map((record) => this.mapper.toDomain(record));
  }

  countForBot(organizationId: string, botId: string): Promise<number> {
    return this.repository.count({ where: { organizationId, botId } });
  }

  async recordWake(subscription: BotSubscriptionEntity): Promise<boolean> {
    const record = this.mapper.toPersistence(subscription);
    const result = await this.repository.update(
      { id: record.id, version: subscription.versionAtLoad },
      {
        lastTurn: record.lastTurn,
        lastState: record.lastState,
        wakes: record.wakes,
        version: subscription.versionAtLoad + 1,
      },
    );
    const won = result.affected === 1;
    if (won) subscription.markPersisted();
    return won;
  }

  async end(subscription: BotSubscriptionEntity): Promise<boolean> {
    const result = await this.repository.delete({ id: subscription.id });
    return result.affected === 1;
  }

  async scheduleStallCheck(
    subscription: BotSubscriptionEntity,
    turn: number,
    at: Date,
    correlationId: string | null,
  ): Promise<void> {
    await this.outbox.transaction((manager) =>
      this.outbox.stageJob(manager, {
        queue: QUEUE_NAMES.BOT_STALL_CHECKS,
        jobName: CHECK_STALLED_SESSION_JOB,
        payload: { subscriptionId: subscription.id, turn },
        reason: `bot ${subscription.botId} handed session ${subscription.resourceId} task #${turn}: check it got going`,
        aggregateId: subscription.id,
        correlationId,
        availableAt: at,
      }),
    );
  }

  async unsubscribe(organizationId: string, botId: string, sessionId: string): Promise<boolean> {
    const result = await this.repository.delete({
      organizationId,
      botId,
      resourceKind: 'session',
      resourceId: sessionId,
    });
    return (result.affected ?? 0) > 0;
  }
}
