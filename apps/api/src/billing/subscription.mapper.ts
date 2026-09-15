import { Injectable } from '@nestjs/common';
import type { Mapper } from '@oppenheimer/backend-ddd';
import { SubscriptionOrmEntity } from './database/subscription.orm-entity';
import { SubscriptionEntity, type SyncSubscriptionProps } from './domain/subscription.entity';
import { SubscriptionResponseDto } from './dtos/subscription.response.dto';
import type { NormalizedSubscription } from './infrastructure/payment-gateway.port';

/** Maps the subscription aggregate between its domain, persistence and response shapes. */
@Injectable()
export class SubscriptionMapper
  implements Mapper<SubscriptionEntity, SubscriptionOrmEntity, SubscriptionResponseDto>
{
  /**
   * Map a payment-gateway subscription (already normalized off the Stripe SDK)
   * into the domain's sync props — the shape `SubscriptionEntity.sync()` and
   * `.createNew()` consume when reconciling a webhook.
   */
  toSyncProps(data: NormalizedSubscription): SyncSubscriptionProps {
    return {
      stripeCustomerId: data.stripeCustomerId,
      stripePriceId: data.stripePriceId,
      plan: data.plan,
      unitAmount: data.unitAmount,
      currency: data.currency,
      interval: data.interval,
      status: data.status,
      currentPeriodEnd: data.currentPeriodEnd,
      cancelAtPeriodEnd: data.cancelAtPeriodEnd,
      canceledAt: data.canceledAt,
      eventCreatedAt: data.eventCreatedAt,
    };
  }

  toPersistence(entity: SubscriptionEntity): SubscriptionOrmEntity {
    const props = entity.getProps();
    const record = new SubscriptionOrmEntity();
    record.id = entity.id;
    record.userId = props.userId;
    record.stripeCustomerId = props.stripeCustomerId;
    record.stripeSubscriptionId = props.stripeSubscriptionId;
    record.stripePriceId = props.stripePriceId;
    record.plan = props.plan;
    record.unitAmount = props.unitAmount;
    record.currency = props.currency;
    record.interval = props.interval;
    record.status = props.status;
    record.currentPeriodEnd = props.currentPeriodEnd;
    record.cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    record.canceledAt = props.canceledAt;
    record.lastEventAt = props.lastEventAt;
    return record;
  }

  toDomain(record: SubscriptionOrmEntity): SubscriptionEntity {
    return SubscriptionEntity.create({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      props: {
        userId: record.userId,
        stripeCustomerId: record.stripeCustomerId,
        stripeSubscriptionId: record.stripeSubscriptionId,
        stripePriceId: record.stripePriceId,
        plan: record.plan,
        unitAmount: record.unitAmount,
        currency: record.currency,
        interval: record.interval,
        status: record.status,
        currentPeriodEnd: record.currentPeriodEnd,
        cancelAtPeriodEnd: record.cancelAtPeriodEnd,
        canceledAt: record.canceledAt,
        lastEventAt: record.lastEventAt,
      },
    });
  }

  toResponse(entity: SubscriptionEntity): SubscriptionResponseDto {
    const props = entity.getProps();
    const dto = new SubscriptionResponseDto();
    dto.id = entity.id;
    dto.status = props.status;
    dto.priceId = props.stripePriceId;
    dto.plan = props.plan;
    dto.unitAmount = props.unitAmount;
    dto.currency = props.currency;
    dto.interval = props.interval;
    dto.currentPeriodEnd = props.currentPeriodEnd;
    dto.cancelAtPeriodEnd = props.cancelAtPeriodEnd;
    dto.canceledAt = props.canceledAt;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
