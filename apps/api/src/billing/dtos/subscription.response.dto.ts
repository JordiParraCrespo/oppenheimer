import { ApiProperty } from '@nestjs/swagger';
import type { BillingInterval, SubscriptionStatus } from '@oppenheimer/shared';

export class SubscriptionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    enum: [
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused',
    ],
  })
  status!: SubscriptionStatus;

  @ApiProperty({ nullable: true, type: String })
  priceId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Human-readable plan name.',
  })
  plan!: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "Recurring amount in the currency's minor unit (e.g. cents).",
  })
  unitAmount!: number | null;

  @ApiProperty({ nullable: true, type: String })
  currency!: string | null;

  @ApiProperty({ nullable: true, enum: ['day', 'week', 'month', 'year'] })
  interval!: BillingInterval | null;

  @ApiProperty({ nullable: true, type: Date })
  currentPeriodEnd!: Date | null;

  @ApiProperty()
  cancelAtPeriodEnd!: boolean;

  @ApiProperty({ nullable: true, type: Date })
  canceledAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
