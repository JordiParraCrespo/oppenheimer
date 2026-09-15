import { ApiProperty } from '@nestjs/swagger';

export class CurrencyMrrDto {
  @ApiProperty()
  currency!: string;

  @ApiProperty({
    description: 'MRR for this currency in its minor unit (e.g. cents).',
  })
  mrr!: number;
}

export class RevenueMetricsResponseDto {
  @ApiProperty({
    description: 'Currency of the headline mrr/arr — the currency with the highest MRR.',
  })
  currency!: string;

  @ApiProperty({
    description: 'Headline Monthly Recurring Revenue in minor units (yearly plans normalized /12).',
  })
  mrr!: number;

  @ApiProperty({
    description: 'Headline Annual Recurring Revenue in minor units (mrr * 12).',
  })
  arr!: number;

  @ApiProperty({
    type: [CurrencyMrrDto],
    description: 'Per-currency MRR breakdown (never mixes currencies into one total).',
  })
  mrrByCurrency!: CurrencyMrrDto[];

  @ApiProperty()
  activeSubscriptions!: number;

  @ApiProperty()
  trialingSubscriptions!: number;

  @ApiProperty()
  pastDueSubscriptions!: number;

  @ApiProperty()
  canceledSubscriptions!: number;

  @ApiProperty({
    description: 'Subscriptions canceled within the trailing 30 days.',
  })
  canceledLast30Days!: number;

  @ApiProperty({
    description:
      'Approximate monthly churn: canceledLast30Days / (active + canceledLast30Days), in [0, 1].',
  })
  churnRate!: number;
}
