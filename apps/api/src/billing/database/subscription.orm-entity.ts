import { CreatedAtColumn, TimestampColumn, UpdatedAtColumn } from '@oppenheimer/backend-ddd';
import type { BillingInterval, SubscriptionStatus } from '@oppenheimer/shared';
import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Persistence model for the application-owned `subscription` table — a local
 * mirror of a Stripe Subscription kept in sync through webhooks. The domain
 * `SubscriptionEntity` is mapped to/from this record by `SubscriptionMapper`.
 */
@Entity('subscription')
export class SubscriptionOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Index()
  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar' })
  stripeCustomerId!: string;

  @Column({ type: 'varchar', unique: true })
  stripeSubscriptionId!: string;

  @Column({ type: 'varchar', nullable: true })
  stripePriceId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  plan!: string | null;

  /** Recurring amount in the currency's minor unit (e.g. cents). */
  @Column({ type: 'integer', nullable: true })
  unitAmount!: number | null;

  @Column({ type: 'varchar', nullable: true })
  currency!: string | null;

  @Column({ type: 'varchar', nullable: true })
  interval!: BillingInterval | null;

  @Column({ type: 'varchar' })
  status!: SubscriptionStatus;

  @TimestampColumn({ nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @TimestampColumn({ nullable: true })
  canceledAt!: Date | null;

  /**
   * `created` timestamp of the last Stripe event applied to this row. Guards
   * against out-of-order webhook delivery (Stripe does not guarantee order).
   */
  @TimestampColumn({ nullable: true })
  lastEventAt!: Date | null;

  @CreatedAtColumn()
  createdAt!: Date;

  @UpdatedAtColumn()
  updatedAt!: Date;
}
