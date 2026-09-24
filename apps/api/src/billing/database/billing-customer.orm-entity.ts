import { TIMESTAMP_COLUMN_TYPE } from '@oppenheimer/backend-ddd';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Persistence model for the application-owned `billing_customer` table, linking
 * a Oppenheimer user to their Stripe Customer id. Kept separate from the Better-Auth
 * `user` table so Stripe fields never clobber columns another system manages.
 */
@Entity('billing_customer')
export class BillingCustomerOrmEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @Column({ type: 'varchar', unique: true })
  stripeCustomerId!: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  createdAt!: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN_TYPE })
  updatedAt!: Date;
}
