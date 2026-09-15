import { randomUUID } from 'node:crypto';
import {
  AggregateRoot,
  ArgumentNotProvidedException,
  type CreateEntityProps,
} from '@oppenheimer/backend-ddd';

export interface BillingCustomerProps {
  /** The Oppenheimer user this Stripe customer belongs to (one customer per user). */
  userId: string;
  /** The Stripe Customer id (e.g. `cus_123`). */
  stripeCustomerId: string;
}

export interface CreateBillingCustomerProps {
  userId: string;
  stripeCustomerId: string;
}

/**
 * Links a Oppenheimer user to their Stripe Customer. Created the first time a user
 * starts checkout or opens the billing portal, and used to resolve incoming
 * Stripe webhooks (keyed by customer id) back to a user.
 */
export class BillingCustomerEntity extends AggregateRoot<BillingCustomerProps> {
  /** Rehydrate an existing billing customer (used by the mapper). */
  static create(create: CreateEntityProps<BillingCustomerProps>): BillingCustomerEntity {
    return new BillingCustomerEntity(create);
  }

  /** Create a brand-new billing-customer mapping with a generated id. */
  static createNew(props: CreateBillingCustomerProps): BillingCustomerEntity {
    return new BillingCustomerEntity({
      id: randomUUID(),
      props: {
        userId: props.userId,
        stripeCustomerId: props.stripeCustomerId,
      },
    });
  }

  get userId(): string {
    return this.props.userId;
  }

  get stripeCustomerId(): string {
    return this.props.stripeCustomerId;
  }

  public validate(): void {
    if (!this.props.userId?.trim()) {
      throw new ArgumentNotProvidedException('BillingCustomer.userId cannot be empty');
    }
    if (!this.props.stripeCustomerId?.trim()) {
      throw new ArgumentNotProvidedException('BillingCustomer.stripeCustomerId cannot be empty');
    }
  }
}
