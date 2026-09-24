import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import type { BillingInterval, SubscriptionStatus } from '@oppenheimer/shared';
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ type: 'boolean', default: false })
  cancelAtPeriodEnd!: boolean;

  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  canceledAt!: Date | null;

  /**
   * `created` timestamp of the last Stripe event applied to this row. Guards
   * against out-of-order webhook delivery (Stripe does not guarantee order).
   */
  @Column({ type: TIMESTAMP_COLUMN_TYPE, nullable: true })
  lastEventAt!: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
