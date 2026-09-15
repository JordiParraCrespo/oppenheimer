import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ACTIVE_SUBSCRIPTION_STATUSES, type BillingInterval } from '@oppenheimer/shared';
import { SUBSCRIPTION_REPOSITORY } from '../../billing.di-tokens';
import type { SubscriptionRepositoryPort } from '../../database/subscription.repository.port';
import { RevenueMetricsResponseDto } from '../../dtos/revenue-metrics.response.dto';
import { GetRevenueMetricsQuery } from './get-revenue-metrics.query';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** Normalize a recurring amount to its monthly-equivalent minor units. */
function toMonthlyAmount(amount: number, interval: BillingInterval | null): number {
  switch (interval) {
    case 'year':
      return amount / 12;
    case 'week':
      return (amount * 52) / 12;
    case 'day':
      return amount * 30;
    default:
      return amount; // 'month' or unknown
  }
}

/**
 * Computes aggregate revenue metrics (MRR, ARR, counts, approximate churn) from
 * the locally synced subscription table — no live Stripe calls.
 */
@QueryHandler(GetRevenueMetricsQuery)
export class GetRevenueMetricsQueryHandler
  implements IQueryHandler<GetRevenueMetricsQuery, RevenueMetricsResponseDto>
{
  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptions: SubscriptionRepositoryPort,
  ) {}

  async execute(): Promise<RevenueMetricsResponseDto> {
    const [active, trialing, pastDue, canceled, revenueSubscriptions] = await Promise.all([
      this.subscriptions.countByStatus('active'),
      this.subscriptions.countByStatus('trialing'),
      this.subscriptions.countByStatus('past_due'),
      this.subscriptions.countByStatus('canceled'),
      this.subscriptions.findByStatuses(ACTIVE_SUBSCRIPTION_STATUSES),
    ]);
    const canceledLast30Days = await this.subscriptions.countCanceledSince(
      new Date(Date.now() - THIRTY_DAYS_MS),
    );

    // Sum MRR per currency so mixed-currency accounts are never conflated.
    const mrrPerCurrency = new Map<string, number>();
    for (const subscription of revenueSubscriptions) {
      const props = subscription.getProps();
      if (props.unitAmount == null || !props.currency) continue;
      const monthly = toMonthlyAmount(props.unitAmount, props.interval);
      mrrPerCurrency.set(props.currency, (mrrPerCurrency.get(props.currency) ?? 0) + monthly);
    }

    const mrrByCurrency = [...mrrPerCurrency.entries()]
      .map(([currency, sum]) => ({ currency, mrr: Math.round(sum) }))
      .sort((a, b) => b.mrr - a.mrr);
    // Headline figures use the dominant currency (highest MRR), never a mix.
    const headline = mrrByCurrency[0] ?? { currency: 'usd', mrr: 0 };

    const activeLike = active + trialing + pastDue;
    const churnDenominator = activeLike + canceledLast30Days;
    const churnRate = churnDenominator > 0 ? canceledLast30Days / churnDenominator : 0;

    const dto = new RevenueMetricsResponseDto();
    dto.currency = headline.currency;
    dto.mrr = headline.mrr;
    dto.arr = headline.mrr * 12;
    dto.mrrByCurrency = mrrByCurrency;
    dto.activeSubscriptions = active;
    dto.trialingSubscriptions = trialing;
    dto.pastDueSubscriptions = pastDue;
    dto.canceledSubscriptions = canceled;
    dto.canceledLast30Days = canceledLast30Days;
    dto.churnRate = churnRate;
    return dto;
  }
}
